import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import {
  ProjectLabel,
  ProjectMemberItem,
  ProjectRole,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES_ORDER,
  TASK_STATUS_LABELS,
  TaskPriority,
  TaskStatus,
} from '../../shared/types/domain';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { Input } from '../../shared/ui/Input';
import { Spinner } from '../../shared/ui/Spinner';
import { tasksApi } from './tasksApi';

interface CreateTaskModalProps {
  projectId: string;
  myRole: ProjectRole;
  members: ProjectMemberItem[];
  labels: ProjectLabel[];
  initialStatus?: TaskStatus;
  onClose: () => void;
}

export function CreateTaskModal({
  projectId,
  myRole,
  members,
  labels,
  initialStatus = 'NEW',
  onClose,
}: CreateTaskModalProps) {
  const queryClient = useQueryClient();
  const isLeader = myRole === 'LEADER';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    );
  };

  const createMutation = useMutation({
    mutationFn: () =>
      tasksApi.create(projectId, {
        title,
        description,
        status,
        priority,
        ...(isLeader ? { assigneeId: assigneeId || null } : {}),
        ...(startDate ? { startDate } : {}),
        ...(deadline ? { deadline } : {}),
        labelIds: selectedLabelIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      onClose();
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : 'Не удалось создать задачу.',
      );
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-xs">
      <Card className="my-auto w-full max-w-xl p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-semibold text-slate-900">Новая задача</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Input
            label="Название задачи"
            placeholder="Например: Спроектировать схему базы данных"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
            maxLength={200}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Описание и критерии выполнения
            </label>
            <textarea
              rows={3}
              placeholder="Подробности задачи, ссылки, ожидаемый результат..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Статус
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
          </div>

          {isLeader ? (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Исполнитель
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="">Не назначен</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.fullName} (@{m.user.username})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Назначение исполнителя доступно только руководителю проекта.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>

          {labels.length > 0 && (
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-700">
                Метки проекта
              </span>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => {
                  const selected = selectedLabelIds.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => toggleLabel(label.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                        selected
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
                })}
              </div>
            </div>
          )}

          {error && <Alert tone="error">{error}</Alert>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Spinner />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Создать задачу
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
