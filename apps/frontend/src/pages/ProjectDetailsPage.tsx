import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  Calendar,
  Crown,
  KanbanSquare,
  Settings2,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { projectsApi } from '../features/projects/projectsApi';
import { ApiError } from '../shared/api/client';
import {
  ACCOUNT_TYPE_LABELS,
  PROJECT_ROLE_LABELS,
  ProjectRole,
  ProjectStatus,
} from '../shared/types/domain';
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

export function ProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'settings'>(
    'overview',
  );

  // Форма добавления участника
  const [identifier, setIdentifier] = useState('');
  const [memberRole, setMemberRole] = useState<'MEMBER' | 'OBSERVER'>('MEMBER');
  const [memberMsg, setMemberMsg] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  // Форма настроек проекта (только для руководителя)
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('ACTIVE');
  const [settingsMsg, setSettingsMsg] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const project = data?.project;
  const isLeader = project?.myRole === 'LEADER';

  useEffect(() => {
    if (project) {
      setEditName(project.name);
      setEditDescription(project.description);
      setEditStartDate(
        project.startDate ? project.startDate.slice(0, 10) : '',
      );
      setEditEndDate(project.endDate ? project.endDate.slice(0, 10) : '');
      setEditStatus(project.status);
    }
  }, [project]);

  const addMemberMutation = useMutation({
    mutationFn: () =>
      projectsApi.addMember(projectId!, { identifier, role: memberRole }),
    onSuccess: (res) => {
      setIdentifier('');
      setMemberMsg({
        tone: 'success',
        text: `Пользователь ${res.member.user.fullName} добавлен в проект как «${PROJECT_ROLE_LABELS[res.member.role]}».`,
      });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      setMemberMsg({
        tone: 'error',
        text:
          err instanceof ApiError
            ? err.message
            : 'Не удалось добавить участника.',
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: 'MEMBER' | 'OBSERVER';
    }) => projectsApi.updateMemberRole(projectId!, userId, role),
    onSuccess: () => {
      setMemberMsg({
        tone: 'success',
        text: 'Роль участника обновлена.',
      });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err) => {
      setMemberMsg({
        tone: 'error',
        text:
          err instanceof ApiError ? err.message : 'Не удалось изменить роль.',
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      projectsApi.removeMember(projectId!, userId),
    onSuccess: () => {
      setMemberMsg({
        tone: 'success',
        text: 'Участник удалён из проекта.',
      });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      setMemberMsg({
        tone: 'error',
        text:
          err instanceof ApiError
            ? err.message
            : 'Не удалось удалить участника.',
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: () =>
      projectsApi.update(projectId!, {
        name: editName,
        description: editDescription,
        startDate: editStartDate || null,
        endDate: editEndDate || null,
        status: editStatus,
      }),
    onSuccess: () => {
      setSettingsMsg({
        tone: 'success',
        text: 'Настройки проекта сохранены.',
      });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      setSettingsMsg({
        tone: 'error',
        text:
          err instanceof ApiError
            ? err.message
            : 'Не удалось сохранить изменения.',
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => projectsApi.remove(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects', { replace: true });
    },
    onError: (err) => {
      setSettingsMsg({
        tone: 'error',
        text:
          err instanceof ApiError
            ? err.message
            : 'Не удалось удалить проект.',
      });
    },
  });

  const handleAddMemberSubmit = (e: FormEvent) => {
    e.preventDefault();
    setMemberMsg(null);
    addMemberMutation.mutate();
  };

  const handleSettingsSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSettingsMsg(null);
    updateProjectMutation.mutate();
  };

  const handleDeleteProject = () => {
    if (
      window.confirm(
        `Вы уверены, что хотите безвозвратно удалить проект «${project?.name}» и все связанные с ним данные?`,
      )
    ) {
      deleteProjectMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6 text-slate-700" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Card className="p-6 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-500" />
          <h1 className="mt-3 text-lg font-semibold text-slate-900">
            Нет доступа к проекту
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            {error instanceof ApiError
              ? error.message
              : 'Проект не найден или вы не являетесь его участником.'}
          </p>
          <div className="mt-5">
            <Link to="/projects">
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" />К списку проектов
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Шапка проекта */}
      <div className="space-y-3">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Назад к проектам
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {project.name}
              </h1>
              <Badge tone={ROLE_TONES[project.myRole]}>
                Ваша роль: {PROJECT_ROLE_LABELS[project.myRole]}
              </Badge>
              {project.status === 'ARCHIVED' && (
                <Badge tone="warning">
                  <Archive className="h-3 w-3" />
                  Архивный
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Руководитель проекта:{' '}
              <span className="font-medium text-slate-800">
                {project.leader.fullName}
              </span>{' '}
              (@{project.leader.username})
            </p>
          </div>
        </div>
      </div>

      {/* Вкладки навигации внутри проекта */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <KanbanSquare className="h-4 w-4" />
          Обзор и задачи
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
            activeTab === 'members'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="h-4 w-4" />
          Участники ({project.memberships.length})
        </button>

        {isLeader && (
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Settings2 className="h-4 w-4" />
            Управление проектом
          </button>
        )}
      </div>

      {/* Вкладка 1: Обзор */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <h2 className="text-base font-semibold text-slate-900">
              Описание проекта
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {project.description || 'Описание проекта пока не добавлено.'}
            </p>

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <KanbanSquare className="h-4 w-4 text-slate-700" />
                Канбан-доска и задачи проекта
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Модуль создания задач и канбан-доска с 6 статусами будут
                подключены на следующих этапах (Этапы 4–5). Ваша текущая роль в
                проекте:{' '}
                <strong>{PROJECT_ROLE_LABELS[project.myRole]}</strong>.
              </p>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="text-base font-semibold text-slate-900">
              Сведения о проекте
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Руководитель</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {project.leader.fullName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Участников</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {project.memberships.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Сроки</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-slate-800">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  <span>
                    {project.startDate
                      ? new Date(project.startDate).toLocaleDateString('ru-RU')
                      : 'не задано'}{' '}
                    —{' '}
                    {project.endDate
                      ? new Date(project.endDate).toLocaleDateString('ru-RU')
                      : 'не задано'}
                  </span>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      )}

      {/* Вкладка 2: Участники и роли */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {isLeader && (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-slate-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  Добавить участника в проект
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Укажите email или логин зарегистрированного пользователя и
                выберите его роль. Руководитель у проекта единственный — его
                создатель.
              </p>

              <form
                onSubmit={handleAddMemberSubmit}
                className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <Input
                    label="Email или имя пользователя"
                    placeholder="student@university.ru или ivan_petrov"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5 sm:w-48">
                  <label className="block text-sm font-medium text-slate-700">
                    Роль в проекте
                  </label>
                  <select
                    value={memberRole}
                    onChange={(e) =>
                      setMemberRole(e.target.value as 'MEMBER' | 'OBSERVER')
                    }
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="MEMBER">Участник</option>
                    <option value="OBSERVER">Наблюдатель</option>
                  </select>
                </div>

                <Button type="submit" disabled={addMemberMutation.isPending}>
                  {addMemberMutation.isPending && <Spinner />}
                  Добавить
                </Button>
              </form>

              {memberMsg && (
                <div className="mt-3">
                  <Alert tone={memberMsg.tone}>{memberMsg.text}</Alert>
                </div>
              )}
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Состав участников проекта
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {project.memberships.map((member) => {
                const isProjectLeader = member.userId === project.leaderId;
                const displayRole: ProjectRole = isProjectLeader
                  ? 'LEADER'
                  : member.role;

                return (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {member.user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {member.user.fullName}
                          </span>
                          <span className="text-xs text-slate-500">
                            @{member.user.username}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                            {ACCOUNT_TYPE_LABELS[member.user.accountType]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {member.user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isProjectLeader ? (
                        <Badge tone="success">
                          <Crown className="h-3 w-3" />
                          Руководитель
                        </Badge>
                      ) : isLeader ? (
                        <>
                          <select
                            aria-label="Роль участника"
                            value={member.role}
                            disabled={updateRoleMutation.isPending}
                            onChange={(e) =>
                              updateRoleMutation.mutate({
                                userId: member.userId,
                                role: e.target.value as 'MEMBER' | 'OBSERVER',
                              })
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-slate-900 focus:outline-none"
                          >
                            <option value="MEMBER">Участник</option>
                            <option value="OBSERVER">Наблюдатель</option>
                          </select>

                          <button
                            type="button"
                            title="Удалить участника из проекта"
                            disabled={removeMemberMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Удалить ${member.user.fullName} из проекта?`,
                                )
                              ) {
                                removeMemberMutation.mutate(member.userId);
                              }
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <Badge tone={ROLE_TONES[displayRole]}>
                          {PROJECT_ROLE_LABELS[displayRole]}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Вкладка 3: Управление проектом (только руководитель) */}
      {activeTab === 'settings' && isLeader && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Основные параметры проекта
            </h2>

            <form onSubmit={handleSettingsSubmit} className="mt-4 space-y-4">
              <Input
                label="Название проекта"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                minLength={2}
                maxLength={150}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Описание
                </label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={2000}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  label="Дата начала"
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
                <Input
                  label="Дата завершения"
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Статус проекта
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as ProjectStatus)
                    }
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="ACTIVE">Активный</option>
                    <option value="ARCHIVED">В архиве</option>
                  </select>
                </div>
              </div>

              {settingsMsg && (
                <Alert tone={settingsMsg.tone}>{settingsMsg.text}</Alert>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={updateProjectMutation.isPending}
                >
                  {updateProjectMutation.isPending && <Spinner />}
                  Сохранить изменения
                </Button>
              </div>
            </form>
          </Card>

          <Card className="border-rose-200 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-rose-800">
              Удаление проекта
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Удаление проекта необратимо удалит список участников и все задачи
              внутри проекта.
            </p>
            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                className="border-rose-300 text-rose-700 hover:bg-rose-50"
                onClick={handleDeleteProject}
                disabled={deleteProjectMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Удалить проект навсегда
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
