import { apiRequest } from '../../shared/api/client';
import {
  MyTaskItem,
  MyTasksStats,
  ProjectLabel,
  TaskComment,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '../../shared/types/domain';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assigneeId?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  startDate?: string | null;
  deadline?: string | null;
  labelIds?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  position?: number;
  startDate?: string | null;
  deadline?: string | null;
  labelIds?: string[];
}

export const tasksApi = {
  listMyTasks: () =>
    apiRequest<{ tasks: MyTaskItem[]; stats: MyTasksStats }>('/users/me/tasks'),

  listByProject: (projectId: string) =>
    apiRequest<{ tasks: TaskItem[] }>(`/projects/${projectId}/tasks`),

  getById: (projectId: string, taskId: string) =>
    apiRequest<{ task: TaskItem }>(`/projects/${projectId}/tasks/${taskId}`),

  create: (projectId: string, payload: CreateTaskPayload) =>
    apiRequest<{ task: TaskItem }>(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (projectId: string, taskId: string, payload: UpdateTaskPayload) =>
    apiRequest<{ task: TaskItem }>(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateStatus: (
    projectId: string,
    taskId: string,
    status: TaskStatus,
    position?: number,
  ) =>
    apiRequest<{ task: TaskItem }>(
      `/projects/${projectId}/tasks/${taskId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          ...(position !== undefined ? { position } : {}),
        }),
      },
    ),

  remove: (projectId: string, taskId: string) =>
    apiRequest<void>(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
    }),

  listLabels: (projectId: string) =>
    apiRequest<{ labels: ProjectLabel[] }>(`/projects/${projectId}/labels`),

  createLabel: (projectId: string, payload: { name: string; color?: string }) =>
    apiRequest<{ label: ProjectLabel }>(`/projects/${projectId}/labels`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  removeLabel: (projectId: string, labelId: string) =>
    apiRequest<void>(`/projects/${projectId}/labels/${labelId}`, {
      method: 'DELETE',
    }),

  listComments: (projectId: string, taskId: string) =>
    apiRequest<{ comments: TaskComment[] }>(
      `/projects/${projectId}/tasks/${taskId}/comments`,
    ),

  createComment: (projectId: string, taskId: string, text: string) =>
    apiRequest<{ comment: TaskComment }>(
      `/projects/${projectId}/tasks/${taskId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      },
    ),

  deleteComment: (projectId: string, taskId: string, commentId: string) =>
    apiRequest<void>(
      `/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
      {
        method: 'DELETE',
      },
    ),
};
