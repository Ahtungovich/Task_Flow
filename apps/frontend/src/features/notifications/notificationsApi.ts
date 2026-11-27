// !! Добавлен API-клиент для работы с внутренними уведомлениями пользователя (Этап 12)
import { apiRequest } from '../../shared/api/client';
import { NotificationItem } from '../../shared/types/domain';

export const notificationsApi = {
  // Получить список всех уведомлений пользователя и количество непрочитанных
  list: () =>
    apiRequest<{ notifications: NotificationItem[]; unreadCount: number }>(
      '/notifications'
    ),

  // Получить актуальное количество непрочитанных уведомлений
  getUnreadCount: () =>
    apiRequest<{ unreadCount: number }>('/notifications/unread-count'),

  // Отметить конкретное уведомление прочитанным
  markRead: (notificationId: string) =>
    apiRequest<{ success: boolean }>(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    }),

  // Отметить все уведомления прочитанными
  markAllRead: () =>
    apiRequest<{ success: boolean }>('/notifications/read-all', {
      method: 'POST',
    }),
};
