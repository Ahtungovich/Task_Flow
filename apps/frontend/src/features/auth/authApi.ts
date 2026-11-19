import { apiRequest } from '../../shared/api/client';
import { UserProfile } from '../../shared/types/domain';

export interface RegisterPayload {
  email: string;
  username: string;
  fullName: string;
  password: string;
  accountType: 'STUDENT' | 'TEACHER';
}

export interface LoginPayload {
  login: string;
  password: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  username?: string;
  avatar?: string | null;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export const authApi = {
  getMe: () => apiRequest<{ user: UserProfile }>('/auth/me'),

  register: (payload: RegisterPayload) =>
    apiRequest<{ user: UserProfile }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginPayload) =>
    apiRequest<{ user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    apiRequest<{ success: true }>('/auth/logout', {
      method: 'POST',
    }),

  updateProfile: (payload: UpdateProfilePayload) =>
    apiRequest<{ user: UserProfile }>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  changePassword: (payload: ChangePasswordPayload) =>
    apiRequest<{ success: true }>('/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};
