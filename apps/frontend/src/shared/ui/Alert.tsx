import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { ReactNode } from 'react';

type AlertTone = 'error' | 'success' | 'info';

const TONE_CLASSES: Record<AlertTone, string> = {
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-slate-200 bg-slate-100 text-slate-800',
};

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: AlertTone;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border p-3.5 text-sm ${TONE_CLASSES[tone]}`}
    >
      {tone === 'error' ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
      ) : tone === 'success' ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : null}
      <div className="flex-1">{children}</div>
    </div>
  );
}
