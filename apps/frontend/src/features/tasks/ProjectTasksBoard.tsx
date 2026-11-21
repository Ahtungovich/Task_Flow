import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  Filter,
  KanbanSquare,
  List,
  MessageSquare,
  Plus,
  Tag,
  Trash2,
  User,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import {
  ProjectMemberItem,
  ProjectRole,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES_ORDER,
  TASK_STATUS_LABELS,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '../../shared/types/domain';
import { Alert } from '../../shared/ui/Alert';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { Input } from '../../shared/ui/Input';
import { Spinner } from '../../shared/ui/Spinner';
import { useAuth } from '../auth/AuthContext';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskDetailsModal } from './TaskDetailsModal';
import {
  PRIORITY_BADGE_CLASSES,
  STATUS_BADGE_TONES,
  STATUS_COLUMN_ACCENTS,
  formatShortDate,
} from './taskUiHelpers';
import { tasksApi } from './tasksApi';

interface ProjectTasksBoardProps {
  projectId: string;
  myRole: ProjectRole;
  members: ProjectMemberItem[];
}

export function ProjectTasksBoard({
  projectId,
  myRole,
  members,
}: ProjectTasksBoardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isLeader = myRole === 'LEADER';
  const canCreateTask = myRole === 'LEADER' || myRole === 'MEMBER';

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [labelFilter, setLabelFilter] = useState<string>('ALL');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Модальные окна и панель меток
  const [createModalStatus, setCreateModalStatus] = useState<TaskStatus | null>(
    null,
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [labelsPanelOpen, setLabelsPanelOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#2563eb');
  const [labelError, setLabelError] = useState<string | null>(null);

  // Drag-and-drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [boardActionError, setBoardActionError] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: () => tasksApi.listByProject(projectId),
  });

  const labelsQuery = useQuery({
    queryKey: ['project-labels', projectId],
    queryFn: () => tasksApi.listLabels(projectId),
  });

  const statusMutation = useMutation({
    mutationFn: ({
      taskId,
      status,
    }: {
      taskId: string;
      status: TaskStatus;
    }) => tasksApi.updateStatus(projectId, taskId, status),
    onSuccess: () => {
      setBoardActionError(null);
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    },
    onError: (err) => {
      setBoardActionError(
        err instanceof ApiError
          ? err.message
          : 'Не удалось изменить статус задачи.',
      );
    },
  });

  const createLabelMutation = useMutation({
    mutationFn: () =>
      tasksApi.createLabel(projectId, {
        name: newLabelName,
        color: newLabelColor,
      }),
    onSuccess: () => {
      setNewLabelName('');
      setLabelError(null);
      queryClient.invalidateQueries({ queryKey: ['project-labels', projectId] });
    },
    onError: (err) => {
      setLabelError(
        err instanceof ApiError ? err.message : 'Не удалось создать метку.',
      );
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: (labelId: string) => tasksApi.removeLabel(projectId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-labels', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    },
  });

  const tasks = tasksQuery.data?.tasks ?? [];
  const labels = labelsQuery.data?.labels ?? [];

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (
        searchQuery.trim() !== '' &&
        !task.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) {
        return false;
      }
      if (assigneeFilter === 'UNASSIGNED' && task.assigneeId !== null) {
        return false;
      }
      if (
        assigneeFilter !== 'ALL' &&
        assigneeFilter !== 'UNASSIGNED' &&
        task.assigneeId !== assigneeFilter
      ) {
        return false;
      }
      if (
        labelFilter !== 'ALL' &&
        !task.labels.some((l) => l.id === labelFilter)
      ) {
        return false;
      }
      if (onlyOverdue && !task.isOverdue) {
        return false;
      }
      return true;
    });
  }, [
    tasks,
    searchQuery,
    priorityFilter,
    assigneeFilter,
    labelFilter,
    onlyOverdue,
  ]);

  const canMoveTask = (task: TaskItem): boolean => {
    if (myRole === 'OBSERVER') return false;
    if (isLeader) return true;
    if (task.assigneeId === user?.id) return true;
    if (task.authorId === user?.id && task.assigneeId === null) return true;
    return false;
  };

  const handleDropOnColumn = (targetStatus: TaskStatus) => {
    setDragOverStatus(null);
    if (!draggedTaskId) return;
    const task = tasks.find((t) => t.id === draggedTaskId);
    setDraggedTaskId(null);
    if (!task || task.status === targetStatus) return;
    if (!canMoveTask(task)) {
      setBoardActionError(
        'Вы можете перемещать только назначенные вам задачи.',
      );
      return;
    }
    statusMutation.mutate({ taskId: task.id, status: targetStatus });
  };

  const handleCreateLabel = (e: FormEvent) => {
    e.preventDefault();
    setLabelError(null);
    createLabelMutation.mutate();
  };

  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) ?? null
    : null;

  return (
    <div className="space-y-5">
      {/* Верхняя панель управления доской */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KanbanSquare className="h-3.5 w-3.5" />
              Канбан-доска
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Список ({filteredTasks.length})
            </button>
          </div>

          {isLeader && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLabelsPanelOpen((prev) => !prev)}
            >
              <Tag className="h-4 w-4" />
              Метки проекта ({labels.length})
            </Button>
          )}
        </div>

        {canCreateTask && (
          <Button type="button" onClick={() => setCreateModalStatus('NEW')}>
            <Plus className="h-4 w-4" />
            Новая задача
          </Button>
        )}
      </div>

      {/* Панель управления метками (только для руководителя) */}
      {labelsPanelOpen && isLeader && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Метки проекта
          </h3>
          <form
            onSubmit={handleCreateLabel}
            className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Input
                label="Название метки"
                placeholder="Например: Backend, Документация, Срочно"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                required
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Цвет
              </label>
              <input
                type="color"
                value={newLabelColor}
                onChange={(e) => setNewLabelColor(e.target.value)}
                className="h-[38px] w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
              />
            </div>
            <Button type="submit" disabled={createLabelMutation.isPending}>
              Добавить метку
            </Button>
          </form>

          {labelError && (
            <div className="mt-2">
              <Alert tone="error">{labelError}</Alert>
            </div>
          )}

          {labels.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {labels.map((lbl) => (
                <span
                  key={lbl.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: lbl.color }}
                  />
                  {lbl.name}
                  <button
                    type="button"
                    onClick={() => deleteLabelMutation.mutate(lbl.id)}
                    className="ml-1 text-slate-400 hover:text-rose-600"
                    title="Удалить метку"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Панель фильтрации задач */}
      <Card className="p-3.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <select
            aria-label="Фильтр по приоритету"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
          >
            <option value="ALL">Все приоритеты</option>
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as TaskPriority[]).map(
              (pr) => (
                <option key={pr} value={pr}>
                  Приоритет: {TASK_PRIORITY_LABELS[pr]}
                </option>
              ),
            )}
          </select>

          <select
            aria-label="Фильтр по исполнителю"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
          >
            <option value="ALL">Все исполнители</option>
            <option value="UNASSIGNED">Без исполнителя</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.fullName}
              </option>
            ))}
          </select>

          <select
            aria-label="Фильтр по метке"
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
          >
            <option value="ALL">Все метки</option>
            {labels.map((lbl) => (
              <option key={lbl.id} value={lbl.id}>
                Метка: {lbl.name}
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
            <Filter className="h-3.5 w-3.5 text-rose-600" />
            Только просроченные
          </label>
        </div>
      </Card>

      {boardActionError && (
        <Alert tone="error">{boardActionError}</Alert>
      )}

      {tasksQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-6 w-6 text-slate-700" />
        </div>
      ) : tasksQuery.error ? (
        <Alert tone="error">
          {tasksQuery.error instanceof ApiError
            ? tasksQuery.error.message
            : 'Не удалось загрузить задачи проекта.'}
        </Alert>
      ) : viewMode === 'kanban' ? (
        /* ==========================================
           РЕЖИМ 1: КАНБАН-ДОСКА (6 СТАТУСОВ)
           ========================================== */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TASK_STATUSES_ORDER.map((columnStatus) => {
            const columnTasks = filteredTasks.filter(
              (t) => t.status === columnStatus,
            );
            const isOver = dragOverStatus === columnStatus;

            return (
              <div
                key={columnStatus}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStatus(columnStatus);
                }}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={() => handleDropOnColumn(columnStatus)}
                className={`flex w-72 shrink-0 flex-col rounded-xl border border-t-4 bg-slate-100/80 p-3 transition-colors ${
                  STATUS_COLUMN_ACCENTS[columnStatus]
                } ${
                  isOver
                    ? 'border-slate-400 bg-slate-200/70'
                    : 'border-slate-200'
                }`}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold tracking-wide text-slate-800 uppercase">
                      {TASK_STATUS_LABELS[columnStatus]}
                    </h3>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-2xs">
                      {columnTasks.length}
                    </span>
                  </div>

                  {canCreateTask && (
                    <button
                      type="button"
                      onClick={() => setCreateModalStatus(columnStatus)}
                      className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-900"
                      title={`Добавить задачу в «${TASK_STATUS_LABELS[columnStatus]}»`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-2.5">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300/80 py-6 text-center text-xs text-slate-400">
                      Нет задач
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const draggable = canMoveTask(task);
                      return (
                        <div
                          key={task.id}
                          draggable={draggable}
                          onDragStart={() => setDraggedTaskId(task.id)}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDragOverStatus(null);
                          }}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`cursor-pointer rounded-lg border bg-white p-3 shadow-2xs transition-all hover:border-slate-400 hover:shadow-sm ${
                            task.isOverdue
                              ? 'border-rose-300 bg-rose-50/30'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
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

                          <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-900">
                            {task.title}
                          </p>

                          {task.labels.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
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
                          )}

                          {/* Быстрое переключение статуса без drag-and-drop (удобно с телефона) */}
                          {draggable && (
                            <div
                              className="mt-2.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <select
                                aria-label="Сменить статус задачи"
                                value={task.status}
                                onChange={(e) =>
                                  statusMutation.mutate({
                                    taskId: task.id,
                                    status: e.target.value as TaskStatus,
                                  })
                                }
                                className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 focus:border-slate-900 focus:outline-none"
                              >
                                {TASK_STATUSES_ORDER.map((st) => (
                                  <option key={st} value={st}>
                                    → {TASK_STATUS_LABELS[st]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 truncate pr-2">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {task.assignee
                                  ? task.assignee.fullName
                                  : 'Не назначен'}
                              </span>
                            </span>

                            <div className="flex shrink-0 items-center gap-2">
                              {task.deadline && (
                                <span
                                  className={`inline-flex items-center gap-0.5 ${
                                    task.isOverdue
                                      ? 'font-semibold text-rose-600'
                                      : ''
                                  }`}
                                >
                                  <Calendar className="h-3 w-3" />
                                  {formatShortDate(task.deadline)}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-0.5">
                                <MessageSquare className="h-3 w-3" />
                                {task.commentsCount}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ==========================================
           РЕЖИМ 2: ТАБЛИЧНЫЙ СПИСОК ЗАДАЧ
           ========================================== */
        <Card className="overflow-hidden">
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Задачи по выбранным фильтрам не найдены.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3">Задача</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3">Приоритет</th>
                    <th className="px-4 py-3">Исполнитель</th>
                    <th className="px-4 py-3">Дедлайн</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {task.title}
                        </p>
                        {task.labels.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
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
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_BADGE_TONES[task.status]}>
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE_CLASSES[task.priority]}`}
                        >
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {task.assignee
                          ? task.assignee.fullName
                          : 'Не назначен'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {task.deadline ? (
                          <span
                            className={
                              task.isOverdue
                                ? 'font-semibold text-rose-600'
                                : 'text-slate-600'
                            }
                          >
                            {formatShortDate(task.deadline)}
                            {task.isOverdue ? ' (просрочена)' : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Модальное окно создания задачи */}
      {createModalStatus && (
        <CreateTaskModal
          projectId={projectId}
          myRole={myRole}
          members={members}
          labels={labels}
          initialStatus={createModalStatus}
          onClose={() => setCreateModalStatus(null)}
        />
      )}

      {/* Модальное окно просмотра и редактирования задачи */}
      {selectedTask && (
        <TaskDetailsModal
          projectId={projectId}
          task={selectedTask}
          myRole={myRole}
          members={members}
          labels={labels}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
