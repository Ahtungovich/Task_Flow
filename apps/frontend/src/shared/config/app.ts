export const APP_CONFIG = {
  appName: import.meta.env.VITE_APP_NAME || 'TaskFlow',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
} as const;
