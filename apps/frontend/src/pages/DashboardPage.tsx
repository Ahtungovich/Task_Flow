import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  FolderKanban,
  FolderPlus,
  UserCircle2,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { projectsApi } from '../features/projects/projectsApi';
import {
  ACCOUNT_TYPE_LABELS,
  PROJECT_ROLE_LABELS,
  ProjectRole,
} from '../shared/types/domain';
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

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  if (!user) return null;

  const canCreateProject =
    user.accountType === 'TEACHER' && user.isTeacherVerified;
  const projects = data?.projects ?? [];

  return (
    <div className="space-y-6">
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
            Личный кабинет пользователя @{user.username}
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
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

          {isLoading ? (
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
              {projects.slice(0, 5).map((project) => (
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

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900">Мои задачи</h2>
          <p className="mt-3 text-sm text-slate-500">
            Назначенные вам задачи из всех проектов появятся здесь после
            реализации модуля задач (Этапы 4–5).
          </p>
        </Card>
      </div>
    </div>
  );
}
