import { TaskPriority, TaskStatus } from '../../shared/types/domain';

export const STATUS_COLUMN_ACCENTS: Record<TaskStatus, string> = {
  NEW: 'border-t-slate-400',
  IN_PROGRESS: 'border-t-blue-500',
  IN_REVIEW: 'border-t-amber-500',
  DONE: 'border-t-emerald-500',
  BLOCKED: 'border-t-rose-500',
  POSTPONED: 'border-t-purple-500',
};

export const STATUS_BADGE_TONES: Record<
  TaskStatus,
  'neutral' | 'success' | 'warning'
> = {
  NEW: 'neutral',
  IN_PROGRESS: 'neutral',
  IN_REVIEW: 'warning',
  DONE: 'success',
  BLOCKED: 'warning',
  POSTPONED: 'neutral',
};

export const PRIORITY_BADGE_CLASSES: Record<TaskPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
  MEDIUM: 'bg-sky-50 text-sky-700 border-sky-200',
  HIGH: 'bg-amber-50 text-amber-800 border-amber-200',
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}
