import { apiRequest } from '../../shared/api/client';
import {
  TeacherApplicationItem,
  TeacherVerificationStats,
} from '../../shared/types/domain';

export type TeacherFilterStatus = 'all' | 'pending' | 'verified';

export const adminApi = {
  listTeachers: (status: TeacherFilterStatus = 'all') =>
    apiRequest<{
      teachers: TeacherApplicationItem[];
      stats: TeacherVerificationStats;
    }>(`/admin/teachers?status=${status}`),

  verifyTeacher: (userId: string, verified: boolean) =>
    apiRequest<{ teacher: TeacherApplicationItem }>(
      `/admin/teachers/${userId}/verify`,
      {
        method: 'PATCH',
        body: JSON.stringify({ verified }),
      }
    ),
};
