import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  Clock,
  MessageSquare,
  Send,
  Save,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import {
  ProjectLabel,
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
import {
  PRIORITY_BADGE_CLASSES,
  formatShortDate,
  toDateInputValue,
} from './taskUiHelpers';
import { tasksApi } from './tasksApi';

interface TaskDetailsModalProps {
  projectId: string;
  task: TaskItem;
  myRole: ProjectRole;
  members: ProjectMemberItem[];
  labels: ProjectLabel[];
  onClose: () => void;
}

export function TaskDetailsModal({
  projectId,
  task,
  myRole,
  members,
  labels,
  onClose,
}: TaskDetailsModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isLeader = myRole === 'LEADER';
  const isObserver = myRole === 'OBSERVER';
  const isAuthor = task.authorId === user?.id;
  const isAssignee = task.assigneeId === user?.id;

  // Права редактирования полей (п. 5.1 и 5.2 ТЗ)
  const canEditFields = !isObserver && (isLeader || isAuthor);
  // Права изменения статуса
  const canChangeStatus =
    !isObserver &&
    (isLeader ||
      isAssignee ||
      (isAuthor && task.assigneeId === null));
  // Права удаления задачи
  const canDelete = !isObserver && (isLeader || isAuthor);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? '');
  const [startDate, setStartDate] = useState(toDateInputValue(task.startDate));
  const [deadline, setDeadline] = useState(toDateInputValue(task.deadline));
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(
    task.labels.map((l) => l.id),
  );
  const [commentText, setCommentText] = useState('');
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);


  const commentsQuery = useQuery({
    queryKey: ['task-comments', projectId, task.id],
    queryFn: () => tasksApi.listComments(projectId, task.id),
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  const comments = commentsQuery.data?.comments ?? [];

  const createCommentMutation = useMutation({
    mutationFn: () => tasksApi.createComment(projectId, task.id, commentText),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({
        queryKey: ['task-comments', projectId, task.id],
      });
      // обновляем список задач: сервер вернёт актуальный commentsCount для карточки канбана
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    },
    onError: (err) => {
      setFeedback({
        tone: 'error',
        text:
          err instanceof ApiError ? err.message : 'Не удалось отправить комментарий.',
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) =>
      tasksApi.removeComment(projectId, task.id, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['task-comments', projectId, task.id],
      });
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    },
    onError: (err) => {
      setFeedback({
        tone: 'error',
        text:
          err instanceof ApiError ? err.message : 'Не удалось удалить комментарий.',
      });
    },
  });

  const handleCreateComment = () => {
    if (!commentText.trim() || createCommentMutation.isPending) return;
    setFeedback(null);
    createCommentMutation.mutate();
  };
  const toggleLabel = (labelId: string) => {
    if (!canEditFields) return;
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (canEditFields) {
        return tasksApi.update(projectId, task.id, {
          title,
          description,
          status,
          priority,
          ...(isLeader ? { assigneeId: assigneeId || null } : {}),
          startDate: startDate || null,
          deadline: deadline || null,
          labelIds: selectedLabelIds,
        });
      }
      if (canChangeStatus && status !== task.status) {
        return tasksApi.updateStatus(projectId, task.id, status);
      }
      return { task };
    },
    onSuccess: () => {
      setFeedback({ tone: 'success', text: 'Изменения задачи сохранены.' });
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err) => {
      setFeedback({
        tone: 'error',
        text:
          err instanceof ApiError
            ? err.message
            : 'Не удалось сохранить изменения.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.remove(projectId, task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      onClose();
    },
    onError: (err) => {
      setFeedback({
        tone: 'error',
        text:
          err instanceof ApiError ? err.message : 'Не удалось удалить задачу.',
      });
    },
  });

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    saveMutation.mutate();
  };

  const handleDelete = () => {
    if (
      window.confirm(
        `Удалить задачу «${task.title}»? Это действие нельзя отменить.`,
      )
    ) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-xs">
      <Card className="my-auto w-full max-w-2xl p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE_CLASSES[task.priority]}`}
              >
                Приоритет: {TASK_PRIORITY_LABELS[task.priority]}
              </span>
              {task.isOverdue && (
                <Badge tone="warning">
                  <AlertTriangle className="h-3 w-3" />
                  Просрочена
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Автор: <span className="font-medium">{task.author.fullName}</span>{' '}
              · Создана {formatShortDate(task.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {canEditFields ? (
            <Input
              label="Название задачи"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={2}
              maxLength={200}
            />
          ) : (
            <div>
              <h2 className="text-lg font-bold text-slate-900">{task.title}</h2>
            </div>
          )}

          {canEditFields ? (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Описание
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                placeholder="Описание отсутствует..."
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5 text-sm whitespace-pre-line text-slate-700">
              {task.description || 'Описание задачи не заполнено.'}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Статус
              </label>
              <select
                value={status}
                disabled={!canChangeStatus}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              >
                {TASK_STATUSES_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {TASK_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Приоритет
              </label>
              <select
                value={priority}
                disabled={!canEditFields}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              >
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as TaskPriority[]).map(
                  (pr) => (
                    <option key={pr} value={pr}>
                      {TASK_PRIORITY_LABELS[pr]}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Исполнитель
              </label>
              {isLeader ? (
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value="">Не назначен</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.fullName}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate">
                    {task.assignee ? task.assignee.fullName : 'Не назначен'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {canEditFields ? (
              <>
                <Input
                  label="Дата начала"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  label="Дедлайн"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>
                    Начало:{' '}
                    <strong>
                      {formatShortDate(task.startDate) ?? 'не задано'}
                    </strong>
                  </span>
                </div>
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    task.isOverdue
                      ? 'border-rose-200 bg-rose-50 text-rose-800'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  <span>
                    Дедлайн:{' '}
                    <strong>
                      {formatShortDate(task.deadline) ?? 'не задан'}
                    </strong>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Метки задачи */}
          {(labels.length > 0 || task.labels.length > 0) && (
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-700">
                Метки
              </span>
              <div className="flex flex-wrap gap-1.5">
                {canEditFields
                  ? labels.map((label) => {
                      const active = selectedLabelIds.includes(label.id);
                      return (
                        <button
                          key={label.id}
                          type="button"
                          onClick={() => toggleLabel(label.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                            active
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: label.color }}
                          />
                          {label.name}
                        </button>
                      );
                    })
                  : task.labels.map((label) => (
                      <span
                        key={label.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: label.color }}
                        />
                        {label.name}
                      </span>
                    ))}
              </div>
            </div>
          )}

          {/* Обсуждение задачи: лента, отправка и удаление комментариев */}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                Обсуждение
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                {commentsQuery.isLoading ? '…' : comments.length}
              </span>
            </div>

            {commentsQuery.isLoading ? (
              <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
                <Spinner /> Загружаем комментарии…
              </div>
            ) : commentsQuery.error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {commentsQuery.error instanceof ApiError
                  ? commentsQuery.error.message
                  : 'Не удалось загрузить комментарии.'}
                <button
                  type="button"
                  onClick={() => commentsQuery.refetch()}
                  className="ml-2 font-semibold underline"
                >
                  Повторить
                </button>
              </div>
            ) : comments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500">
                Пока нет комментариев. Начните обсуждение задачи.
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {comments.map((comment) => {
                  const canDeleteComment =
                    isLeader || comment.authorId === user?.id;
                  return (
                    <article
                      key={comment.id}
                      className="rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {comment.author.fullName}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {new Date(comment.createdAt).toLocaleString('ru-RU', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                        {canDeleteComment && (
                          <button
                            type="button"
                            title="Удалить комментарий"
                            aria-label="Удалить комментарий"
                            disabled={deleteCommentMutation.isPending}
                            onClick={() => {
                              if (window.confirm('Удалить этот комментарий?')) {
                                deleteCommentMutation.mutate(comment.id);
                              }
                            }}
                            className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                        {comment.text}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <label className="block text-xs font-medium text-slate-700" htmlFor="task-comment-input">
                Написать комментарий
              </label>
              <textarea
                id="task-comment-input"
                rows={3}
                maxLength={5000}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Введите сообщение…"
                className="block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  {commentText.length}/5000
                </span>
                <Button
                  type="button"
                  onClick={handleCreateComment}
                  disabled={!commentText.trim() || createCommentMutation.isPending}
                >
                  {createCommentMutation.isPending ? <Spinner /> : <Send className="h-3.5 w-3.5" />}
                  Отправить
                </Button>
              </div>
            </div>
          </section>

          {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div>
              {canDelete && (
                <Button
                  type="button"
                  variant="secondary"
                  className="border-rose-200 text-rose-700 hover:bg-rose-50"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить задачу
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Закрыть
              </Button>
              {(canEditFields || canChangeStatus) && (
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <Spinner />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Сохранить
                </Button>
              )}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
