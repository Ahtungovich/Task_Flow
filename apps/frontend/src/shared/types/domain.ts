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
