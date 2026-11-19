import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Database, RefreshCw, Server, XCircle } from 'lucide-react';
import { apiRequest } from '../shared/api/client';
import { APP_CONFIG } from '../shared/config/app';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { Spinner } from '../shared/ui/Spinner';

interface HealthResponse {
  status: 'ok';
  appName: string;
  environment: string;
  database: 'connected';
  timestamp: string;
}

export function HomePage() {
  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => apiRequest<HealthResponse>('/health'),
    retry: false,
  });

  const isHealthy = Boolean(data && data.status === 'ok');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {APP_CONFIG.appName} — планирование учебных проектов
        </h1>
        <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
          Единое пространство для преподавателей и студентов: проекты, роли,
          канбан-доска, сроки и обсуждение задач. Сейчас развёрнута базовая
          инфраструктура (Этап 1).
        </p>
      </section>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Состояние сервисов
            </h2>
            <p className="text-xs text-slate-500">
              Проверка связи Frontend → NestJS API → PostgreSQL
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
            />
            Проверить снова
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2.5">
              <Server className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-800">
                Backend API
              </span>
            </div>
            {isLoading ? (
              <Badge tone="neutral">
                <Spinner className="h-3 w-3" />
                Проверка
              </Badge>
            ) : isHealthy ? (
              <Badge tone="success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Доступен
              </Badge>
            ) : (
              <Badge tone="danger">
                <XCircle className="h-3.5 w-3.5" />
                Недоступен
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2.5">
              <Database className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-800">
                PostgreSQL
              </span>
            </div>
            {isLoading ? (
              <Badge tone="neutral">
                <Spinner className="h-3 w-3" />
                Проверка
              </Badge>
            ) : data?.database === 'connected' ? (
              <Badge tone="success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Подключена
              </Badge>
            ) : (
              <Badge tone="danger">
                <XCircle className="h-3.5 w-3.5" />
                Нет связи
              </Badge>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
            <p className="font-medium">Ошибка проверки подключения</p>
            <p className="mt-1 text-xs text-rose-700">
              {error instanceof Error ? error.message : 'Неизвестная ошибка'}
            </p>
          </div>
        )}

        {data && (
          <dl className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:grid-cols-2">
            <div>
              <dt className="inline font-medium text-slate-700">Окружение: </dt>
              <dd className="inline">{data.environment}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-slate-700">
                Последняя проверка:{' '}
              </dt>
              <dd className="inline">
                {new Date(data.timestamp).toLocaleString('ru-RU')}
              </dd>
            </div>
          </dl>
        )}
      </Card>
    </div>
  );
}
