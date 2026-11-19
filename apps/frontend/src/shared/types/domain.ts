export type AccountType = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type ProjectRole = 'LEADER' | 'MEMBER' | 'OBSERVER';

export type TaskStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE'
  | 'BLOCKED'
  | 'POSTPONED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatar: string | null;
  accountType: AccountType;
  isTeacherVerified: boolean;
  emailVerified: boolean;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectUserSummary {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatar: string | null;
  accountType: AccountType;
}

export interface ProjectMemberItem {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  user: ProjectUserSummary;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  leaderId: string;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  myRole: ProjectRole;
  leader: ProjectUserSummary;
  _count?: {
    memberships: number;
    tasks: number;
  };
}

export interface ProjectDetails extends ProjectSummary {
  creator: ProjectUserSummary;
  memberships: ProjectMemberItem[];
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  IN_REVIEW: 'На проверке',
  DONE: 'Готово',
  BLOCKED: 'Заблокировано',
  POSTPONED: 'Отложено',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  CRITICAL: 'Критический',
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  LEADER: 'Руководитель',
  MEMBER: 'Участник',
  OBSERVER: 'Наблюдатель',
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  STUDENT: 'Студент',
  TEACHER: 'Преподаватель',
  ADMIN: 'Системный администратор',
};
