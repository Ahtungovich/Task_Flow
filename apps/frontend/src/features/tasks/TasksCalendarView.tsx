// !! Добавлен новый компонент интерактивного календарного представления задач (Этап 9)
// Компонент строит полноценную сетку месяца, распределяет задачи по датам дедлайнов,
// подсвечивает сегодняшний день и просроченные задачи, а также позволяет выбрать любой день
// и перейти прямо к нужной карточке внутри проекта.
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MyTaskItem,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from '../../shared/types/domain';
import { Badge } from '../../shared/ui/Badge';
import {
  PRIORITY_BADGE_CLASSES,
  STATUS_BADGE_TONES,
  formatShortDate,
} from './taskUiHelpers';

// !! Описаны пропсы компонента: на вход передаётся уже отфильтрованный список задач пользователя
interface TasksCalendarViewProps {
  tasks: MyTaskItem[];
}

// !! Заданы названия месяцев и дней недели на русском языке для шапки календаря
const MONTH_NAMES_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const WEEKDAYS_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// !! Добавлена вспомогательная функция для приведения даты к единому ключу формата YYYY-MM-DD
// Это нужно, чтобы точно группировать задачи по календарным дням без расхождений из-за времени суток
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// !! Добавлен парсер ISO-строки дедлайна из API в локальный ключ дня YYYY-MM-DD
function parseIsoToDateKey(isoString: string | null): string | null {
  if (!isoString) return null;
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
}

// !! Добавлена функция форматирования выбранного ключа дня YYYY-MM-DD в читаемую подпись для панели деталей
function formatDateKeyHuman(dateKey: string): string {
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = Number(dayStr);
  if (!year || monthIndex < 0 || monthIndex > 11 || !day) return dateKey;
  return `${day} ${MONTH_NAMES_RU[monthIndex].toLowerCase()} ${year} г.`;
}

export function TasksCalendarView({ tasks }: TasksCalendarViewProps) {
  // !! Инициализируем состояние текущего просматриваемого месяца и выбранного дня (по умолчанию — сегодня)
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  // !! Группируем задачи по дате дедлайна и отдельно собираем задачи, у которых дедлайн не указан
  const { tasksByDate, tasksWithoutDeadline } = useMemo(() => {
    const grouped = new Map<string, MyTaskItem[]>();
    const noDeadline: MyTaskItem[] = [];

    for (const task of tasks) {
      const key = parseIsoToDateKey(task.deadline);
      if (!key) {
        noDeadline.push(task);
        continue;
      }
      const existing = grouped.get(key) ?? [];
      existing.push(task);
      grouped.set(key, existing);
    }

    return { tasksByDate: grouped, tasksWithoutDeadline: noDeadline };
  }, [tasks]);

  // !! Строим календарную сетку выбранного месяца (от понедельника до воскресенья, ровно 35 или 42 ячейки)
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // В JS getDay() возвращает 0 для воскресенья; переводим в европейский формат где Пн = 0, Вс = 6
    const startWeekday = (firstDayOfMonth.getDay() + 6) % 7;
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const cells: Array<{
      date: Date;
      dateKey: string;
      isCurrentMonth: boolean;
    }> = [];

    // Добавляем хвост предыдущего месяца для выравнивания первой недели
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      cells.push({
        date: d,
        dateKey: toDateKey(d),
        isCurrentMonth: false,
      });
    }

    // Добавляем все дни текущего месяца
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({
        date: d,
        dateKey: toDateKey(d),
        isCurrentMonth: true,
      });
    }

    // Добиваем сетку днями следующего месяца до полного числа недель (кратно 7)
    let nextMonthDay = 1;
    while (cells.length % 7 !== 0) {
      const d = new Date(year, month + 1, nextMonthDay++);
      cells.push({
        date: d,
        dateKey: toDateKey(d),
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [currentMonthDate]);

  // !! Считаем сколько задач попадает именно на открытый в календаре месяц
  const tasksInVisibleMonthCount = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const monthPrefix = `${year}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-`;
    let count = 0;
    for (const [key, list] of tasksByDate.entries()) {
      if (key.startsWith(monthPrefix)) {
        count += list.length;
      }
    }
    return count;
  }, [currentMonthDate, tasksByDate]);

  // !! Обработчики переключения месяцев и быстрого возврата на текущую дату
  const handlePrevMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const handleGoToday = () => {
    const now = new Date();
    setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateKey(toDateKey(now));
  };

  const selectedDayTasks = tasksByDate.get(selectedDateKey) ?? [];
  const monthTitle = `${MONTH_NAMES_RU[currentMonthDate.getMonth()]} ${currentMonthDate.getFullYear()}`;

  return (
    <div className="mt-4 space-y-4">
      {/* !! Панель навигации по месяцам и счётчик задач за выбранный месяц */}
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Предыдущий месяц"
            className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 transition-colors hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="min-w-[150px] text-center text-sm font-semibold text-slate-900">
            {monthTitle}
          </span>

          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Следующий месяц"
            className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 transition-colors hover:bg-slate-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleGoToday}
            className="ml-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Сегодня
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>
            Дедлайнов в этом месяце:{' '}
            <strong className="text-slate-900">{tasksInVisibleMonthCount}</strong>
          </span>
          {tasksWithoutDeadline.length > 0 && (
            <span className="text-slate-500">
              Без срока: <strong>{tasksWithoutDeadline.length}</strong>
            </span>
          )}
        </div>
      </div>

      {/* !! Заголовки дней недели (Пн — Вс) и основная календарная сетка */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAYS_SHORT_RU.map((dayName, idx) => (
            <div
              key={dayName}
              className={`py-2 text-center text-xs font-semibold ${
                idx >= 5 ? 'text-rose-600/80' : 'text-slate-600'
              }`}
            >
              {dayName}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {calendarDays.map((cell) => {
            const dayTasks = tasksByDate.get(cell.dateKey) ?? [];
            const isToday = cell.dateKey === todayKey;
            const isSelected = cell.dateKey === selectedDateKey;
            const hasOverdue = dayTasks.some((t) => t.isOverdue);

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => setSelectedDateKey(cell.dateKey)}
                className={`flex min-h-[84px] flex-col justify-between p-1.5 text-left transition-colors sm:min-h-[96px] sm:p-2 ${
                  !cell.isCurrentMonth
                    ? 'bg-slate-50/70 text-slate-400'
                    : 'bg-white text-slate-900'
                } ${
                  isSelected
                    ? 'ring-2 ring-inset ring-slate-900'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* !! Номер дня и индикатор наличия просроченных задач */}
                <div className="flex w-full items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday
                        ? 'bg-slate-900 text-white'
                        : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>

                  {dayTasks.length > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        hasOverdue
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                {/* !! Компактные бейджи первых двух задач прямо внутри ячейки календаря */}
                <div className="mt-1 w-full space-y-1">
                  {dayTasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        task.status === 'DONE'
                          ? 'bg-emerald-50 text-emerald-700 line-through'
                          : task.isOverdue
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-800'
                      }`}
                      title={`${task.project.name}: ${task.title}`}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="px-1 text-[10px] font-medium text-slate-500">
                      + ещё {dayTasks.length - 2}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* !! Детальный список задач на выбранный в календаре день */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              Задачи на {formatDateKeyHuman(selectedDateKey)} ({selectedDayTasks.length})
            </h3>
          </div>
          {selectedDateKey === todayKey && (
            <Badge tone="neutral">Сегодня</Badge>
          )}
        </div>

        {selectedDayTasks.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            На выбранную дату дедлайнов не запланировано. Нажмите на любой
            другой день в календаре, чтобы посмотреть задачи.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-200/70 rounded-lg border border-slate-200 bg-white">
            {selectedDayTasks.map((task) => (
              <Link
                key={task.id}
                to={`/projects/${task.projectId}?taskId=${task.id}`}
                className={`block px-3.5 py-3 transition-colors hover:bg-slate-50 ${
                  task.isOverdue ? 'bg-rose-50/30' : ''
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {task.project.name}
                    </span>
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_BADGE_CLASSES[task.priority]}`}
                    >
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </span>
                    {task.isOverdue && (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                        <AlertTriangle className="h-3 w-3" />
                        Просрочена
                      </span>
                    )}
                  </div>

                  <Badge tone={STATUS_BADGE_TONES[task.status]}>
                    {TASK_STATUS_LABELS[task.status]}
                  </Badge>
                </div>

                <p className="mt-1.5 text-sm font-medium text-slate-900">
                  {task.title}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {task.startDate
                      ? `Старт: ${formatShortDate(task.startDate)}`
                      : 'Дата старта не указана'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {task.commentsCount}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* !! Отдельный компактный блок для задач без указанного дедлайна, чтобы они не терялись в режиме календаря */}
      {tasksWithoutDeadline.length > 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Задачи без указанного дедлайна ({tasksWithoutDeadline.length})
            </h3>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {tasksWithoutDeadline.map((task) => (
              <Link
                key={task.id}
                to={`/projects/${task.projectId}?taskId=${task.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-100"
              >
                <span className="font-medium text-slate-500">
                  [{task.project.name}]
                </span>
                <span className="font-medium">{task.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
