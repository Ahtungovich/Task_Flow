import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  FolderPlus,
  ListTodo,
  MessageSquare,
  UserCircle2,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { projectsApi } from '../features/projects/projectsApi';
import {
  PRIORITY_BADGE_CLASSES,
  STATUS_BADGE_TONES,
  formatShortDate,
} from '../features/tasks/taskUiHelpers';
import { tasksApi } from '../features/tasks/tasksApi';
import { ApiError } from '../shared/api/client';
import {
  ACCOUNT_TYPE_LABELS,
  PROJECT_ROLE_LABELS,
  ProjectRole,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES_ORDER,
  TASK_STATUS_LABELS,
} from '../shared/types/domain';
import { Alert } from '../shared/ui/Alert';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { Spinner } from '../shared/ui/Spinner';

const ROLE_TONES: Record<ProjectRole, 'success' | 'neutral' | 'warning'> = {
  LEADER: 'success',
  MEMBER: 'neutral',
  OBSERVER: 'warning',
};

export function DashboardPage() {
  const { user } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE_ONLY');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const myTasksQuery = useQuery({
    queryKey: ['my-tasks'],
    queryFn: tasksApi.listMyTasks,
  });

  const projects = projectsQuery.data?.projects ?? [];
  const allMyTasks = myTasksQuery.data?.tasks ?? [];
  const stats = myTasksQuery.data?.stats ?? {
    total: 0,
    active: 0,
    inProgress: 0,
    done: 0,
    overdue: 0,
  };

  const filteredTasks = useMemo(() => {
    return allMyTasks.filter((task) => {
      if (statusFilter === 'ACTIVE_ONLY' && task.status === 'DONE') {
        return false;
      }
      if (
        statusFilter !== 'ALL' &&
        statusFilter !== 'ACTIVE_ONLY' &&
        task.status !== statusFilter
      ) {
        return false;
      }
      if (projectFilter !== 'ALL' && task.projectId !== projectFilter) {
        return false;
      }
      if (onlyOverdue && !task.isOverdue) {
        return false;
      }
      return true;
    });
  }, [allMyTasks, statusFilter, projectFilter, onlyOverdue]);

  if (!user) return null;

  const canCreateProject =
    user.accountType === 'TEACHER' && user.isTeacherVerified;

  return (
    <div className="space-y-6">
      {/* Приветствие и быстрые кнопки */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">
              Добро пожаловать, {user.fullName}
            </h1>
            <Badge
              tone={user.accountType === 'TEACHER' ? 'success' : 'neutral'}
            >
              {ACCOUNT_TYPE_LABELS[user.accountType]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Агрегированный личный кабинет @{user.username} — сводка по проектам и
            назначенным задачам
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canCreateProject && (
            <Link to="/projects">
              <Button>
                <FolderPlus className="h-4 w-4" />
                Новый проект
              </Button>
            </Link>
          )}
          <Link to="/profile">
            <Button variant="secondary">
              <UserCircle2 className="h-4 w-4" />
              Профиль
            </Button>
          </Link>
        </div>
      </div>

      {/* Сводные карточки статистики */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Мои проекты</span>
            <FolderKanban className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {projects.length}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Активные задачи</span>
            <ListTodo className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {stats.active}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Всего назначено: {stats.total}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Выполнено</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {stats.done}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            В работе / проверке: {stats.inProgress}
          </p>
        </Card>

        <Card
          className={`p-4 ${
            stats.overdue > 0 ? 'border-rose-200 bg-rose-50/40' : ''
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Просрочено</span>
            <AlertTriangle
              className={`h-4 w-4 ${
                stats.overdue > 0 ? 'text-rose-600' : 'text-slate-400'
              }`}
            />
          </div>
          <p
            className={`mt-2 text-2xl font-bold ${
              stats.overdue > 0 ? 'text-rose-700' : 'text-slate-900'
            }`}
          >
            {stats.overdue}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Требуют внимания
          </p>
        </Card>
      </div>

      {/* Основная сетка: Мои задачи (слева/шире) и Мои проекты (справа) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Блок «Мои задачи» со всех проектов */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Мои задачи ({filteredTasks.length})
              </h2>
              <p className="text-xs text-slate-500">
                Все задачи из ваших проектов, где вы назначены исполнителем
              </p>
            </div>
          </div>

          {/* Фильтры задач */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              aria-label="Фильтр по статусу"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
            >
              <option value="ACTIVE_ONLY">Активные (кроме Готово)</option>
              <option value="ALL">Все статусы</option>
              {TASK_STATUSES_ORDER.map((st) => (
                <option key={st} value={st}>
                  Статус: {TASK_STATUS_LABELS[st]}
                </option>
              ))}
            </select>

            <select
              aria-label="Фильтр по проекту"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
            >
              <option value="ALL">Все проекты</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <Clock className="h-3.5 w-3.5 text-rose-600" />
              Только просроченные
            </label>
          </div>

          {myTasksQuery.isLoading ? (
            <div className="py-10 text-center">
              <Spinner className="h-6 w-6 text-slate-600" />
            </div>
          ) : myTasksQuery.error ? (
            <div className="mt-4">
              <Alert tone="error">
                {myTasksQuery.error instanceof ApiError
                  ? myTasksQuery.error.message
                  : 'Не удалось загрузить список ваших задач.'}
              </Alert>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-8 text-center">
              <ListTodo className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                Задач по выбранным фильтрам нет
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Когда руководитель назначит вас исполнителем задачи в проекте,
                она сразу появится здесь.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {filteredTasks.map((task) => (
                <Link
                  key={task.id}
                  to={`/projects/${task.projectId}?taskId=${task.id}`}
                  className={`block rounded-lg px-3 py-3 transition-colors hover:bg-slate-50 ${
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

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {task.labels.map((lbl) => (
                        <span
                          key={lbl.id}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: lbl.color }}
                          />
                          {lbl.name}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      {task.deadline && (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            task.isOverdue
                              ? 'font-semibold text-rose-600'
                              : 'text-slate-500'
                          }`}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          Дедлайн: {formatShortDate(task.deadline)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {task.commentsCount}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Блок «Мои проекты» */}
        <Card className="p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Мои проекты ({projects.length})
            </h2>
            <Link
              to="/projects"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
            >
              Все проекты
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {projectsQuery.isLoading ? (
            <div className="py-6 text-center">
              <Spinner className="h-5 w-5 text-slate-600" />
            </div>
          ) : projects.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-center">
              <FolderKanban className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-2 text-sm text-slate-600">
                {canCreateProject
                  ? 'У вас пока нет созданных проектов.'
                  : 'Вы пока не добавлены ни в один проект.'}
              </p>
              {canCreateProject && (
                <Link to="/projects" className="mt-3 inline-block">
                  <Button variant="secondary">Создать проект</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {projects.slice(0, 6).map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="flex items-center justify-between py-2.5 hover:bg-slate-50"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {project.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Руководитель: {project.leader.fullName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Users className="h-3.5 w-3.5" />
                      {project._count?.memberships ?? 1}
                    </span>
                    <Badge tone={ROLE_TONES[project.myRole]}>
                      {PROJECT_ROLE_LABELS[project.myRole]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
