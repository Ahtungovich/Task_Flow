export interface AppEnvConfig {
  NODE_ENV: string;
  APP_NAME: string;
  PORT: number;
  FRONTEND_URL: string;
  DATABASE_URL: string;
  SESSION_SECRET: string;
  SESSION_TTL_HOURS: number;
  COOKIE_SECURE: boolean;
  AUTO_APPROVE_TEACHERS: boolean;
  EMAIL_VERIFICATION_REQUIRED: boolean;
}

export function validateEnv(config: Record<string, unknown>): AppEnvConfig {
  const databaseUrl = String(config.DATABASE_URL ?? '').trim();
  if (!databaseUrl) {
    throw new Error('Переменная окружения DATABASE_URL обязательна и не задана.');
  }

  const sessionSecret = String(config.SESSION_SECRET ?? '').trim();
  if (!sessionSecret || sessionSecret.length < 16) {
    throw new Error(
      'Переменная окружения SESSION_SECRET обязательна (минимум 16 символов).',
    );
  }

  const port = Number(config.PORT ?? 3000);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error('Переменная окружения PORT должна быть корректным номером порта.');
  }

  const sessionTtlHours = Number(config.SESSION_TTL_HOURS ?? 168);
  if (Number.isNaN(sessionTtlHours) || sessionTtlHours <= 0) {
    throw new Error('Переменная окружения SESSION_TTL_HOURS должна быть положительным числом.');
  }

  return {
    NODE_ENV: String(config.NODE_ENV ?? 'development'),
    APP_NAME: String(config.APP_NAME ?? 'TaskFlow'),
    PORT: port,
    FRONTEND_URL: String(config.FRONTEND_URL ?? 'http://localhost:5173'),
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: sessionSecret,
    SESSION_TTL_HOURS: sessionTtlHours,
    COOKIE_SECURE: String(config.COOKIE_SECURE ?? 'false') === 'true',
    AUTO_APPROVE_TEACHERS: String(config.AUTO_APPROVE_TEACHERS ?? 'true') === 'true',
    EMAIL_VERIFICATION_REQUIRED:
      String(config.EMAIL_VERIFICATION_REQUIRED ?? 'false') === 'true',
  };
}
