import { apiRequest } from '../../shared/api/client';
import { TaskItem } from '../../shared/types/domain';

export interface MyAssignedTask extends TaskItem {
  project: {
    id: string;
    name: string;
    status: 'ACTIVE' | 'ARCHIVED';
  };
}

export interface MyTasksResponse {
  tasks: MyAssignedTask[];
  summary: {
    total: number;
    active: number;
    overdue: number;
    completed: number;
  };
}

export const usersApi = {
  myAssignedTasks: () => apiRequest<MyTasksResponse>('/users/me/tasks'),
};
