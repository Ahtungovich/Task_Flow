import { apiRequest } from '../../shared/api/client';
import {
  ProjectDetails,
  ProjectMemberItem,
  ProjectStatus,
  ProjectSummary,
} from '../../shared/types/domain';

export interface CreateProjectPayload {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: ProjectStatus;
}

export interface AddMemberPayload {
  identifier: string;
  role: 'MEMBER' | 'OBSERVER';
}

export const projectsApi = {
  list: () => apiRequest<{ projects: ProjectSummary[] }>('/projects'),

  create: (payload: CreateProjectPayload) =>
    apiRequest<{ project: ProjectSummary }>('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getById: (projectId: string) =>
    apiRequest<{ project: ProjectDetails }>(`/projects/${projectId}`),

  update: (projectId: string, payload: UpdateProjectPayload) =>
    apiRequest<{ project: ProjectSummary }>(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  remove: (projectId: string) =>
    apiRequest<void>(`/projects/${projectId}`, {
      method: 'DELETE',
    }),

  addMember: (projectId: string, payload: AddMemberPayload) =>
    apiRequest<{ member: ProjectMemberItem }>(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMemberRole: (
    projectId: string,
    userId: string,
    role: 'MEMBER' | 'OBSERVER',
  ) =>
    apiRequest<{ member: ProjectMemberItem }>(
      `/projects/${projectId}/members/${userId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      },
    ),

  removeMember: (projectId: string, userId: string) =>
    apiRequest<void>(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    }),
};
