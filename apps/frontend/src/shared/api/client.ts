import { APP_CONFIG } from '../config/app';

export interface ApiErrorPayload {
  statusCode: number;
  error: string;
  message: string | string[];
  path?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: string[];

  constructor(payload: ApiErrorPayload) {
    const normalizedMessage = Array.isArray(payload.message)
      ? payload.message.join('; ')
      : payload.message || 'Произошла ошибка при обращении к серверу.';
    super(normalizedMessage);
    this.name = 'ApiError';
    this.statusCode = payload.statusCode;
    this.details = Array.isArray(payload.message) ? payload.message : undefined;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${APP_CONFIG.apiBaseUrl}${path}`;
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError({
      statusCode: 0,
      error: 'Network Error',
      message:
        'Не удалось связаться с сервером. Проверьте, запущен ли backend.',
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new ApiError(
      data ?? {
        statusCode: response.status,
        error: response.statusText,
        message: 'Сервер вернул ошибку.',
      },
    );
  }

  return data as T;
}
