// !! Добавлен универсальный компонент управления прикреплёнными файлами (Этап 10)
// Работает в двух режимах:
// - Если передан только projectId — отображает и загружает файлы проекта
// - Если переданы projectId и taskId — отображает и загружает файлы конкретной задачи
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Trash2,
  Upload,
} from 'lucide-react';
import { ChangeEvent, useRef, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { AttachmentItem } from '../../shared/types/domain';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { Spinner } from '../../shared/ui/Spinner';
import { useAuth } from '../auth/AuthContext';
import { formatShortDate } from '../tasks/taskUiHelpers';
import { attachmentsApi } from './attachmentsApi';

// !! Описаны входные параметры компонента вложений
interface AttachmentsSectionProps {
  projectId: string;
  taskId?: string;
  canUpload?: boolean;
  isProjectLeader?: boolean;
  title?: string;
}

// !! Функция форматирования размера файла из байтов в понятные Б / КБ / МБ
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

// !! Подбираем подходящую иконку в зависимости от расширения или MIME-типа файла
function renderFileIcon(item: AttachmentItem) {
  const name = item.originalName.toLowerCase();
  const mime = item.contentType.toLowerCase();

  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) {
    return <FileImage className="h-4 w-4 text-violet-600" />;
  }
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) {
    return <FileArchive className="h-4 w-4 text-amber-600" />;
  }
  if (/\.(xlsx?|csv)$/.test(name)) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
  }
  if (/\.(py|ts|tsx|js|jsx|json|sql|html|css|circ)$/.test(name)) {
    return <FileCode2 className="h-4 w-4 text-blue-600" />;
  }
  return <FileText className="h-4 w-4 text-slate-600" />;
}

export function AttachmentsSection({
  projectId,
  taskId,
  canUpload = true,
  isProjectLeader = false,
  title,
}: AttachmentsSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // !! Уникальный ключ кэша TanStack Query для проекта или конкретной задачи
  const queryKey = taskId
    ? ['task-attachments', projectId, taskId]
    : ['project-attachments', projectId];

  const attachmentsQuery = useQuery({
    queryKey,
    queryFn: () =>
      taskId
        ? attachmentsApi.listTaskAttachments(projectId, taskId)
        : attachmentsApi.listProjectAttachments(projectId),
  });

  // !! Мутация загрузки нового файла на сервер
  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      taskId
        ? attachmentsApi.uploadTaskAttachment(projectId, taskId, file)
        : attachmentsApi.uploadProjectAttachment(projectId, file),
    onMutate: () => {
      setUploadError(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (err) => {
      setUploadError(
        err instanceof ApiError
          ? err.message
          : 'Не удалось прикрепить выбранный файл.'
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
  });

  // !! Мутация удаления прикреплённого файла
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      attachmentsApi.deleteAttachment(attachmentId),
    onMutate: (attachmentId) => {
      setDeletingId(attachmentId);
      setUploadError(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      setUploadError(
        err instanceof ApiError ? err.message : 'Не удалось удалить файл.'
      );
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    uploadMutation.mutate(selected);
  };

  const attachments = attachmentsQuery.data?.attachments ?? [];
  const headingText =
    title ?? (taskId ? 'Прикреплённые файлы' : 'Файлы и материалы проекта');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            {headingText} ({attachments.length})
          </h3>
        </div>

        {/* !! Скрытый input type="file" и кнопка выбора файла с диска (до 20 МБ) */}
        {canUpload && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadMutation.isPending ? 'Загрузка...' : 'Прикрепить файл'}
            </Button>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="mt-3">
          <Alert tone="error">{uploadError}</Alert>
        </div>
      )}

      {attachmentsQuery.isLoading ? (
        <div className="py-6 text-center">
          <Spinner className="h-5 w-5 text-slate-600" />
        </div>
      ) : attachmentsQuery.error ? (
        <div className="mt-3">
          <Alert tone="error">
            {attachmentsQuery.error instanceof ApiError
              ? attachmentsQuery.error.message
              : 'Не удалось загрузить список прикреплённых файлов.'}
          </Alert>
        </div>
      ) : attachments.length === 0 ? (
        <p className="mt-2.5 text-xs text-slate-500">
          {taskId
            ? 'К этой задаче пока не прикреплено ни одного файла.'
            : 'В материалы проекта пока не загружено ни одного файла (ТЗ, шаблоны отчётов, архивы до 20 МБ).'}
        </p>
      ) : (
        <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {attachments.map((item) => {
            const canDelete =
              Boolean(user) &&
              (user?.id === item.uploaderId || isProjectLeader);
            const isDeleting = deletingId === item.id;

            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="mt-0.5 shrink-0 rounded-md bg-slate-100 p-1.5">
                    {renderFileIcon(item)}
                  </div>
                  <div className="min-w-0">
                    <a
                      href={attachmentsApi.getDownloadUrl(item.id)}
                      download={item.originalName}
                      className="block truncate text-xs font-semibold text-slate-900 hover:text-blue-700 hover:underline"
                      title={`Скачать ${item.originalName}`}
                    >
                      {item.originalName}
                    </a>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {formatFileSize(item.sizeBytes)} · Загрузил{' '}
                      {item.uploader.fullName} ·{' '}
                      {formatShortDate(item.createdAt)}
                    </p>
                  </div>
                </div>

                {/* !! Кнопки скачивания и удаления прикреплённого файла */}
                <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                  <a
                    href={attachmentsApi.getDownloadUrl(item.id)}
                    download={item.originalName}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Скачать
                  </a>

                  {canDelete && (
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => deleteMutation.mutate(item.id)}
                      title="Удалить файл"
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/60 px-2 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
