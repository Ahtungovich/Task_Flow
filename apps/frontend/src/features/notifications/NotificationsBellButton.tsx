// !! Добавлен компонент кнопки «Уведомления» с красным кружочком-счётчиком и выпадающей панелью (Этап 12)
// Размещается в шапке личного кабинета вместо кнопки «Профиль»:
// - Если непрочитанных уведомлений > 0, отображает красный кружочек с точным количеством
// - Если непрочитанных уведомлений 0, красный кружочек скрыт
// - По клику открывает список уведомлений (новые задания и напоминания за 3 / 1 день до дедлайна)
//   с возможностью перейти прямо в задачу или отметить всё прочитанным
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock,
  FolderPlus,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationItem, NotificationKind } from '../../shared/types/domain';
import { Button } from '../../shared/ui/Button';
import { Spinner } from '../../shared/ui/Spinner';
import { notificationsApi } from './notificationsApi';

function formatNotifTime(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderNotifIcon(kind: NotificationKind) {
  if (kind === 'DEADLINE_1D') {
    return (
      <div className="rounded-lg bg-rose-100 p-2 text-rose-600">
        <AlertTriangle className="h-4 w-4" />
      </div>
    );
  }
  if (kind === 'DEADLINE_3D') {
    return (
      <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
        <Clock className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
      <FolderPlus className="h-4 w-4" />
    </div>
  );
}

export function NotificationsBellButton() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // !! Загружаем уведомления и автоматически обновляем каждые 30 секунд
  const notificationsQuery = useQuery({
    queryKey: ['my-notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    },
  });

  // Закрываем выпадающее окно при клике вне компонента
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }
    setIsOpen(false);
    if (item.projectId && item.taskId) {
      navigate(`/projects/${item.projectId}?taskId=${item.taskId}`);
    } else if (item.projectId) {
      navigate(`/projects/${item.projectId}`);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* !! Кнопка «Уведомления» с красным кружочком непрочитанных (скрыт, если unreadCount === 0) */}
      <Button
        type="button"
        variant="secondary"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative"
        aria-label="Уведомления"
      >
        <Bell className="h-4 w-4" />
        <span>Уведомления</span>

        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold leading-none text-white shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* !! Выпадающая панель со списком уведомлений */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-[400px]">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Уведомления
              </h3>
              <p className="text-[11px] text-slate-500">
                {unreadCount > 0
                  ? `Непрочитанных: ${unreadCount}`
                  : 'Новых уведомлений нет'}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={markAllReadMutation.isPending}
                onClick={() => markAllReadMutation.mutate()}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200/70 disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Прочитать все
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notificationsQuery.isLoading ? (
              <div className="py-8 text-center">
                <Spinner className="h-5 w-5 text-slate-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-xs font-medium text-slate-700">
                  У вас пока нет уведомлений
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Здесь появятся оповещения о новых заданиях и напоминания за 3 и
                  1 день до дедлайна.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                    !item.isRead ? 'bg-blue-50/40' : 'bg-white'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {renderNotifIcon(item.kind)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">
                          {formatNotifTime(item.createdAt)}
                        </span>
                        {!item.isRead && (
                          <span className="h-2 w-2 rounded-full bg-rose-600" />
                        )}
                      </div>
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {item.message}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
