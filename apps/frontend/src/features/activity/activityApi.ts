// !! Добавлен API-клиент для получения истории изменений (логов) проекта (Этап 11)
import { apiRequest } from '../../shared/api/client';
import { ActivityLogItem } from '../../shared/types/domain';

export const activityApi = {
  // Получить журнал событий проекта с фильтрацией по типу сущности
  listProjectActivity: (
    projectId: string,
    params?: { entityType?: string; limit?: number }
  ) => {
    const search = new URLSearchParams();
    if (params?.entityType && params.entityType !== 'ALL') {
      search.set('entityType', params.entityType);
    }
    if (params?.limit) {
      search.set('limit', String(params.limit));
    }
    const qs = search.toString();
    return apiRequest<{ logs: ActivityLogItem[]; total: number }>(
      `/projects/${projectId}/activity${qs ? `?${qs}` : ''}`
    );
  },
};
