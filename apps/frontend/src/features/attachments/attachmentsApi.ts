// !! Добавлен API-клиент для загрузки, получения списка, скачивания и удаления файлов (Этап 10)
import { ApiError, apiRequest } from '../../shared/api/client';
import { AttachmentItem } from '../../shared/types/domain';

// !! Вспомогательная функция отправки FormData с сессионной cookie на эндпоинты загрузки файлов
async function uploadFormData(
  endpoint: string,
  file: File
): Promise<{ attachment: AttachmentItem }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/v1${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const rawMessage = data?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : 'Не удалось загрузить файл.';
    throw new ApiError({ statusCode: response.status, error: typeof data?.error === 'string' ? data.error : 'Upload Error', message });
  }

  return data as { attachment: AttachmentItem };
}

export const attachmentsApi = {
  // Получить список файлов, прикреплённых к проекту
  listProjectAttachments: (projectId: string) =>
    apiRequest<{ attachments: AttachmentItem[] }>(
      `/projects/${projectId}/attachments`
    ),

  // Загрузить файл в материалы проекта
  uploadProjectAttachment: (projectId: string, file: File) =>
    uploadFormData(`/projects/${projectId}/attachments`, file),

  // Получить список файлов, прикреплённых к задаче
  listTaskAttachments: (projectId: string, taskId: string) =>
    apiRequest<{ attachments: AttachmentItem[] }>(
      `/projects/${projectId}/tasks/${taskId}/attachments`
    ),

  // Прикрепить файл к конкретной задаче
  uploadTaskAttachment: (projectId: string, taskId: string, file: File) =>
    uploadFormData(`/projects/${projectId}/tasks/${taskId}/attachments`, file),

  // Удалить прикреплённый файл
  deleteAttachment: (attachmentId: string) =>
    apiRequest<{ success: boolean }>(`/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),

  // Сформировать прямую ссылку на скачивание файла
  getDownloadUrl: (attachmentId: string) =>
    `/api/v1/attachments/${attachmentId}/download`,
};
