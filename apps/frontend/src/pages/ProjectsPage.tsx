import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Calendar,
  FolderKanban,
  FolderPlus,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { projectsApi } from '../features/projects/projectsApi';
import { ApiError } from '../shared/api/client';
import { PROJECT_ROLE_LABELS, ProjectRole } from '../shared/types/domain';
import { Alert } from '../shared/ui/Alert';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { Input } from '../shared/ui/Input';
import { Spinner } from '../shared/ui/Spinner';

const ROLE_TONES: Record<ProjectRole, 'success' | 'neutral' | 'warning'> = {
  LEADER: 'success',
  MEMBER: 'neutral',
  OBSERVER: 'warning',
};

export function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const canCreateProject =
    user?.accountType === 'TEACHER' && user?.isTeacherVerified;

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreateOpen(false);
      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      navigate(`/projects/${res.project.id}`);
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiError
          ? err.message
          : 'Не удалось создать проект.',
      );
    },
  });

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate({
      name,
      description,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    });
  };

  const projects = data?.projects ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Мои проекты</h1>
          <p className="mt-1 text-sm text-slate-600">
            Проекты, в которых вы являетесь руководителем, участником или
            наблюдателем.
          </p>
        </div>

        {canCreateProject && (
          <Button onClick={() => setCreateOpen(true)}>
            <FolderPlus className="h-4 w-4" />
            Создать проект
          </Button>
        )}
      </div>

      {/* Модальное окно создания проекта (только для подтверждённого преподавателя) */}
      {createOpen && canCreateProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Новый учебный проект
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <Input
                label="Название проекта"
                placeholder="Например: Разработка информационной системы кафедры"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={150}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Описание (необязательно)
                </label>
                <textarea
                  rows={3}
                  placeholder="Цели проекта, предметная область, требования к результату..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Дата начала"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  label="Плановая дата завершения"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {formError && <Alert tone="error">{formError}</Alert>}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCreateOpen(false)}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Spinner />}
                  Создать проект
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-6 w-6 text-slate-700" />
        </div>
      ) : error ? (
        <Alert tone="error">
          {error instanceof ApiError
            ? error.message
            : 'Не удалось загрузить список проектов.'}
        </Alert>
      ) : projects.length === 0 ? (
        <Card className="p-8 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">
            Пока нет доступных проектов
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            {canCreateProject
              ? 'Создайте первый проект и добавьте в него студентов или других преподавателей.'
              : 'Когда руководитель добавит вас в учебный проект, он сразу появится в этом списке.'}
          </p>
          {canCreateProject && (
            <div className="mt-5">
              <Button onClick={() => setCreateOpen(true)}>
                <FolderPlus className="h-4 w-4" />
                Создать первый проект
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="group block"
            >
              <Card className="flex h-full flex-col justify-between p-5 transition-all group-hover:border-slate-400 group-hover:shadow-md">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={ROLE_TONES[project.myRole]}>
                      {PROJECT_ROLE_LABELS[project.myRole]}
                    </Badge>
                    {project.status === 'ARCHIVED' && (
                      <Badge tone="warning">
                        <Archive className="h-3 w-3" />
                        В архиве
                      </Badge>
                    )}
                  </div>

                  <h2 className="mt-3 line-clamp-2 text-base font-semibold text-slate-900 group-hover:text-slate-700">
                    {project.name}
                  </h2>

                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                    {project.description || 'Описание проекта не указано.'}
                  </p>
                </div>

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div className="flex items-center justify-between">
                    <span>Руководитель: {project.leader.fullName}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                      <Users className="h-3.5 w-3.5" />
                      {project._count?.memberships ?? 1}
                    </span>
                  </div>
                  {(project.startDate || project.endDate) && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {project.startDate
                          ? new Date(project.startDate).toLocaleDateString('ru-RU')
                          : '—'}{' '}
                        →{' '}
                        {project.endDate
                          ? new Date(project.endDate).toLocaleDateString('ru-RU')
                          : '—'}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
