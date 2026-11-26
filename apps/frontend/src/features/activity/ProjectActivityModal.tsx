// !! Добавлено модальное окно подробной истории изменений (логов) проекта (Этап 11)
// Показывает хронологическую ленту всех действий участников: перемещение задач по колонкам,
// смену исполнителей и дедлайнов, загрузку/удаление файлов, комментарии и изменения команды.
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  FolderKanban,
  History,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { ActivityEntityType, ActivityLogItem } from '../../shared/types/domain';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { Spinner } from '../../shared/ui/Spinner';
import { activityApi } from './activityApi';

interface ProjectActivityModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

const ENTITY_FILTER_TABS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'Все события' },
  { value: 'TASK', label: 'Задачи' },
  { value: 'MEMBER', label: 'Участники' },
  { value: 'ATTACHMENT', label: 'Файлы' },
  { value: 'COMMENT', label: 'Комментарии' },
  { value: 'PROJECT', label: 'Проект и метки' },
];

const ENTITY_BADGE_LABELS: Record<ActivityEntityType, string> = {
  TASK: 'Задача',
  MEMBER: 'Команда',
  ATTACHMENT: 'Файл',
  COMMENT: 'Комментарий',
  PROJECT: 'Проект',
  LABEL: 'Метка',
};

// !! Форматируем дату и время события в читаемый вид (например, «26.11.2026 в 09:54»)
function formatDateTimeRu(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  const datePart = d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} в ${timePart}`;
}

// !! Подбираем иконку и цвет бейджа для каждой категории события в логах
function renderEntityIcon(entityType: ActivityEntityType) {
  switch (entityType) {
    case 'TASK':
      return (
        <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
          <CheckSquare className="h-4 w-4" />
        </div>
      );
    case 'MEMBER':
      return (
        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
          <Users className="h-4 w-4" />
        </div>
      );
    case 'ATTACHMENT':
      return (
        <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
          <Paperclip className="h-4 w-4" />
        </div>
      );
    case 'COMMENT':
      return (
        <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
          <MessageSquare className="h-4 w-4" />
        </div>
      );
    case 'LABEL':
      return (
        <div className="rounded-lg bg-pink-50 p-2 text-pink-600">
          <Tag className="h-4 w-4" />
        </div>
      );
    default:
      return (
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <FolderKanban className="h-4 w-4" />
        </div>
      );
  }
}

export function ProjectActivityModal({
  projectId,
  projectName,
  isOpen,
  onClose,
}: ProjectActivityModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchText, setSearchText] = useState<string>('');

  const activityQuery = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () =>
      activityApi.listProjectActivity(projectId, { limit: 200 }),
    enabled: isOpen,
  });

  const allLogs = activityQuery.data?.logs ?? [];

  // !! Фильтруем загруженные логи по выбранной вкладке категории и текстовому поиску
  const filteredLogs = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return allLogs.filter((item: ActivityLogItem) => {
      if (selectedCategory !== 'ALL') {
        if (selectedCategory === 'PROJECT') {
          if (item.entityType !== 'PROJECT' && item.entityType !== 'LABEL') {
            return false;
          }
        } else if (item.entityType !== selectedCategory) {
          return false;
        }
      }

      if (query) {
        const haystack = [
          item.summary,
          item.details ?? '',
          item.actor?.fullName ?? '',
          item.actor?.username ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [allLogs, selectedCategory, searchText]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* !! Шапка модального окна с названием проекта и кнопкой обновления логов */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-slate-900 p-2 text-white">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                История изменений проекта
              </h2>
              <p className="text-xs text-slate-500">
                Журнал всех действий по проекту «{projectName}» (
                {filteredLogs.length})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              disabled={activityQuery.isFetching}
              onClick={() => activityQuery.refetch()}
              title="Обновить журнал"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  activityQuery.isFetching ? 'animate-spin' : ''
                }`}
              />
              Обновить
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть окно"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* !! Панель фильтров по категориям и строка поиска по событиям/участникам */}
        <div className="space-y-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {ENTITY_FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setSelectedCategory(tab.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === tab.value
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Поиск по задаче, участнику или описанию действия..."
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* !! Прокручиваемая лента хронологии событий */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activityQuery.isLoading ? (
            <div className="py-12 text-center">
              <Spinner className="h-6 w-6 text-slate-600" />
            </div>
          ) : activityQuery.error ? (
            <Alert tone="error">
              {activityQuery.error instanceof ApiError
                ? activityQuery.error.message
                : 'Не удалось загрузить историю изменений проекта.'}
            </Alert>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
              <History className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                Записей в истории изменений пока нет
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Любые действия с задачами, участниками, комментариями и файлами
                будут автоматически фиксироваться здесь.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3 transition-colors hover:bg-slate-50/60"
                >
                  <div className="mt-0.5 shrink-0">
                    {renderEntityIcon(log.entityType)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900">
                          {log.actor ? log.actor.fullName : 'Система'}
                        </span>
                        {log.actor && (
                          <span className="text-[11px] text-slate-400">
                            @{log.actor.username}
                          </span>
                        )}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {ENTITY_BADGE_LABELS[log.entityType] ?? log.entityType}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-400">
                        {formatDateTimeRu(log.createdAt)}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-medium text-slate-800">
                      {log.summary}
                    </p>

                    {log.details && (
                      <p className="mt-1 rounded-md bg-slate-100/80 px-2 py-1 text-[11px] text-slate-600">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* !! Подвал модального окна */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}
