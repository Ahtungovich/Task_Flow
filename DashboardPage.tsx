import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  FolderPlus,
  Search,
  UserCircle2,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { projectsApi } from '../features/projects/projectsApi';
import { usersApi } from '../features/users/usersApi';
import {
  ACCOUNT_TYPE_LABELS,
  PROJECT_ROLE_LABELS,
  ProjectRole,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TaskStatus,
} from '../shared/types/domain';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { Spinner } from '../shared/ui/Spinner';
import { formatShortDate } from '../features/tasks/taskUiHelpers';

const ROLE_TONES: Record<ProjectRole, 'success' | 'neutral' | 'warning'> = {
  LEADER: 'success',
  MEMBER: 'neutral',
  OBSERVER: 'warning',
};

const STATUS_TONES: Record<TaskStatus, 'success' | 'neutral' | 'warning' | 'danger'> = {
  NEW: 'neutral',
  IN_PROGRESS: 'warning',
  IN_REVIEW: 'warning',
  DONE: 'success',
  BLOCKED: 'danger',
  POSTPONED: 'neutral',
};

const PRIORITY_TONES = {
  LOW: 'neutral',
  MEDIUM: 'neutral',
  HIGH: 'warning',
  CRITICAL: 'danger',
} as const;

type TaskFilter = 'ALL' | 'ACTIVE' | 'OVERDUE' | 'DONE';

export function DashboardPage() {
  const { user } = useAuth();
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });
  const {
    data: myTasksData,
    isLoading: isTasksLoading,
    isError: isTasksError,
    refetch: refetchMyTasks,
  } = useQuery({
    queryKey: ['my-assigned-tasks'],
    queryFn: usersApi.myAssignedTasks,
    enabled: Boolean(user),
  });

  const projects = data?.projects ?? [];
  const tasks = myTasksData?.tasks ?? [];
  const summary = myTasksData?.summary ?? { total: 0, active: 0, overdue: 0, completed: 0 };
  const canCreateProject = user?.accountType === 'TEACHER' && user.isTeacherVerified;

  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (taskFilter === 'ACTIVE' && task.status === 'DONE') return false;
      if (taskFilter === 'OVERDUE' && !task.isOverdue) return false;
      if (taskFilter === 'DONE' && task.status !== 'DONE') return false;
      if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) return false;
      if (projectFilter !== 'ALL' && task.project.id !== projectFilter) return false;
      if (normalizedSearch && !`${task.title} ${task.project.name}`.toLowerCase().includes(normalizedSearch)) return false;
      return true;
    });
  }, [tasks, taskFilter, priorityFilter, projectFilter, search]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Добро пожаловать, {user.fullName}</h1>
            <Badge tone={user.accountType === 'TEACHER' ? 'success' : 'neutral'}>{ACCOUNT_TYPE_LABELS[user.accountType]}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">Личный кабинет пользователя @{user.username}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateProject && <Link to="/projects"><Button><FolderPlus className="h-4 w-4" />Новый проект</Button></Link>}
          <Link to="/profile"><Button variant="secondary"><UserCircle2 className="h-4 w-4" />Профиль</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><div className="flex items-center gap-2 text-sm text-slate-500"><CheckCircle2 className="h-4 w-4" />Активные задачи</div><p className="mt-2 text-2xl font-bold text-slate-900">{isTasksLoading ? '—' : summary.active}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-sm text-slate-500"><AlertCircle className="h-4 w-4" />Просроченные</div><p className="mt-2 text-2xl font-bold text-rose-600">{isTasksLoading ? '—' : summary.overdue}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-sm text-slate-500"><CheckCircle2 className="h-4 w-4" />Выполненные</div><p className="mt-2 text-2xl font-bold text-slate-900">{isTasksLoading ? '—' : summary.completed}</p></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-base font-semibold text-slate-900">Мои задачи</h2><p className="mt-1 text-xs text-slate-500">Назначенные вам задачи из всех проектов · {summary.total}</p></div>
            <button type="button" onClick={() => void refetchMyTasks()} className="text-xs font-medium text-slate-600 hover:text-slate-900">Обновить</button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по задаче или проекту" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400" /></div>
            <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value as TaskFilter)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="ALL">Все задачи</option><option value="ACTIVE">Активные</option><option value="OVERDUE">Просроченные</option><option value="DONE">Выполненные</option></select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="ALL">Любой приоритет</option>{Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="ALL">Все проекты</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
          </div>

          {isTasksLoading ? <div className="py-10 text-center"><Spinner className="mx-auto h-6 w-6 text-slate-600" /><p className="mt-2 text-xs text-slate-500">Загружаем ваши задачи…</p></div> : isTasksError ? <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Не удалось загрузить задачи. Проверьте подключение и попробуйте обновить список.</div> : filteredTasks.length === 0 ? <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-6 text-center"><FolderKanban className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-sm font-medium text-slate-700">Задачи не найдены</p><p className="mt-1 text-xs text-slate-500">Попробуйте изменить фильтры или дождитесь назначения задачи.</p></div> : <div className="mt-3 divide-y divide-slate-100">
            {filteredTasks.map((task) => <Link key={`${task.project.id}-${task.id}`} to={`/projects/${task.project.id}?task=${task.id}`} className="block rounded-lg px-2 py-3 transition-colors hover:bg-slate-50"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{task.title}</p><p className="mt-1 truncate text-xs text-slate-500">{task.project.name}</p></div><div className="flex shrink-0 flex-wrap gap-1.5"><Badge tone={STATUS_TONES[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge><Badge tone={PRIORITY_TONES[task.priority]}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>{task.isOverdue && <Badge tone="danger">Просрочена</Badge>}</div></div><div className="mt-2 flex items-center gap-3 text-xs text-slate-500">{task.deadline ? <span className={`inline-flex items-center gap-1 ${task.isOverdue ? 'font-medium text-rose-600' : ''}`}><CalendarDays className="h-3.5 w-3.5" />Срок: {formatShortDate(task.deadline)}</span> : <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Без срока</span>}<span className="ml-auto inline-flex items-center gap-1 text-slate-600">Открыть задачу <ArrowRight className="h-3.5 w-3.5" /></span></div></Link>)}
          </div>}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-slate-900">Мои проекты ({projects.length})</h2><Link to="/projects" className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900">Все проекты<ArrowRight className="h-3.5 w-3.5" /></Link></div>
          {isLoading ? <div className="py-6 text-center"><Spinner className="h-5 w-5 text-slate-600" /></div> : projects.length === 0 ? <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-center"><FolderKanban className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-sm text-slate-600">{canCreateProject ? 'У вас пока нет созданных проектов.' : 'Вы пока не добавлены ни в один проект.'}</p>{canCreateProject && <Link to="/projects" className="mt-3 inline-block"><Button variant="secondary">Создать проект</Button></Link>}</div> : <div className="mt-3 divide-y divide-slate-100">{projects.slice(0, 7).map((project) => <Link key={project.id} to={`/projects/${project.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:bg-slate-50"><div className="min-w-0 pr-2"><p className="truncate text-sm font-medium text-slate-900">{project.name}</p><p className="text-xs text-slate-500">Руководитель: {project.leader.fullName}</p></div><div className="flex shrink-0 items-center gap-2"><span className="inline-flex items-center gap-1 text-xs text-slate-500"><Users className="h-3.5 w-3.5" />{project._count?.memberships ?? 1}</span><Badge tone={ROLE_TONES[project.myRole]}>{PROJECT_ROLE_LABELS[project.myRole]}</Badge></div></Link>)}</div>}
        </Card>
      </div>
    </div>
  );
}
