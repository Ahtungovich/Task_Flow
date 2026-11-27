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

export interface TeacherApplicationItem extends UserProfile {
  projectsCount: number;
}

export interface TeacherVerificationStats {
  total: number;
  pending: number;
  verified: number;
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

export interface ProjectLabel {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  author: ProjectUserSummary;
}

export interface AttachmentItem {
  id: string;
  projectId: string;
  taskId: string | null;
  uploaderId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  uploader: ProjectUserSummary;
  downloadUrl: string;
}

export type ActivityEntityType =
  | 'PROJECT'
  | 'MEMBER'
  | 'TASK'
  | 'COMMENT'
  | 'ATTACHMENT'
  | 'LABEL';

export interface ActivityLogItem {
  id: string;
  projectId: string;
  actorId: string | null;
  taskId: string | null;
  entityType: ActivityEntityType;
  action: string;
  summary: string;
  details: string | null;
  createdAt: string;
  actor: ProjectUserSummary | null;
}

// !! Добавлены типы уведомлений на сайте: новое задание и напоминания за 3 и 1 день до дедлайна (Этап 12)
export type NotificationKind = 'TASK_ASSIGNED' | 'DEADLINE_3D' | 'DEADLINE_1D';

export interface NotificationItem {
  id: string;
  userId: string;
  projectId: string | null;
  taskId: string | null;
  kind: NotificationKind;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  projectName: string | null;
}

export interface TaskItem {
  id: string;
  projectId: string;
  authorId: string;
  assigneeId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  startDate: string | null;
  deadline: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  author: ProjectUserSummary;
  assignee: ProjectUserSummary | null;
  labels: ProjectLabel[];
  commentsCount: number;
}

export interface MyTaskItem extends TaskItem {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
  };
}

export interface MyTasksStats {
  total: number;
  active: number;
  inProgress: number;
  done: number;
  overdue: number;
}

export const TASK_STATUSES_ORDER: TaskStatus[] = [
  'NEW',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'BLOCKED',
  'POSTPONED',
];

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
