import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  FolderKanban,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { Alert } from '../../shared/ui/Alert';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { Input } from '../../shared/ui/Input';
import { Spinner } from '../../shared/ui/Spinner';
import { formatShortDate } from '../tasks/taskUiHelpers';
import { adminApi, TeacherFilterStatus } from './adminApi';

export function TeacherVerificationPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TeacherFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const teachersQuery = useQuery({
    queryKey: ['admin-teachers', statusFilter],
    queryFn: () => adminApi.listTeachers(statusFilter),
  });

  const verifyMutation = useMutation({
    mutationFn: ({
      userId,
      verified,
    }: {
      userId: string;
      verified: boolean;
    }) => adminApi.verifyTeacher(userId, verified),
    onMutate: ({ userId }) => {
      setPendingUserId(userId);
      setActionMessage(null);
    },
    onSuccess: (data) => {
      const teacher = data.teacher;
      setActionMessage(
        teacher.isTeacherVerified
          ? `Статус преподавателя для ${teacher.fullName} (@${teacher.username}) подтверждён.`
          : `Подтверждение преподавателя для ${teacher.fullName} (@${teacher.username}) отозвано.`
      );
      queryClient.invalidateQueries({ queryKey: ['admin-teachers'] });
    },
    onSettled: () => {
      setPendingUserId(null);
    },
  });

  const teachers = teachersQuery.data?.teachers ?? [];
  const stats = teachersQuery.data?.stats ?? {
    total: 0,
    pending: 0,
    verified: 0,
  };

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.fullName.toLowerCase().includes(q) ||
        t.username.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q)
    );
  }, [teachers, searchQuery]);

  return (
    <Card className="border-slate-300 p-5">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-900" />
            <h2 className="text-base font-semibold text-slate-900">
              Панель администратора · Верификация преподавателей
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Подтверждайте учётные записи преподавателей, чтобы открыть им доступ
            к созданию учебных проектов
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
            Всего: {stats.total}
          </span>
          <span className="rounded-lg bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
            Ожидают: {stats.pending}
          </span>
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
            Подтверждены: {stats.verified}
          </span>
        </div>
      </div>

      {/* Фильтры и поиск */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: 'all', label: 'Все заявки' },
              { key: 'pending', label: `Ожидают (${stats.pending})` },
              { key: 'verified', label: `Подтверждены (${stats.verified})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по ФИО, логину или email..."
            className="pl-8 text-xs"
          />
        </div>
      </div>

      {actionMessage && (
        <div className="mt-3">
          <Alert tone="success">{actionMessage}</Alert>
        </div>
      )}

      {verifyMutation.error && (
        <div className="mt-3">
          <Alert tone="error">
            {verifyMutation.error instanceof ApiError
              ? verifyMutation.error.message
              : 'Не удалось обновить статус преподавателя.'}
          </Alert>
        </div>
      )}

      {/* Список преподавателей */}
      {teachersQuery.isLoading ? (
        <div className="py-8 text-center">
          <Spinner className="h-6 w-6 text-slate-600" />
        </div>
      ) : teachersQuery.error ? (
        <div className="mt-4">
          <Alert tone="error">
            {teachersQuery.error instanceof ApiError
              ? teachersQuery.error.message
              : 'Не удалось загрузить список преподавателей.'}
          </Alert>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-6 text-center">
          <ShieldCheck className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            Преподавателей по выбранным условиям не найдено
          </p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {filteredTeachers.map((teacher) => {
            const isRowPending = pendingUserId === teacher.id;
            return (
              <div
                key={teacher.id}
                className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {teacher.fullName}
                    </p>
                    <span className="text-xs text-slate-500">
                      @{teacher.username}
                    </span>
                    {teacher.isTeacherVerified ? (
                      <Badge tone="success">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Подтверждён
                        </span>
                      </Badge>
                    ) : (
                      <Badge tone="warning">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Ожидает подтверждения
                        </span>
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{teacher.email}</span>
                    <span>
                      Регистрация: {formatShortDate(teacher.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FolderKanban className="h-3.5 w-3.5" />
                      Проектов: {teacher.projectsCount}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!teacher.isTeacherVerified ? (
                    <Button
                      type="button"
                      disabled={isRowPending}
                      onClick={() =>
                        verifyMutation.mutate({
                          userId: teacher.id,
                          verified: true,
                        })
                      }
                    >
                      <UserCheck className="h-4 w-4" />
                      {isRowPending ? 'Сохранение...' : 'Подтвердить статус'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isRowPending}
                      onClick={() =>
                        verifyMutation.mutate({
                          userId: teacher.id,
                          verified: false,
                        })
                      }
                    >
                      <UserX className="h-4 w-4" />
                      {isRowPending ? 'Сохранение...' : 'Отозвать статус'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
