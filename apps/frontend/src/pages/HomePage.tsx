import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  FolderKanban,
  KanbanSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { apiRequest } from '../shared/api/client';
import { APP_CONFIG } from '../shared/config/app';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';

interface HealthResponse {
  status: 'ok';
  database: 'connected';
}

export function HomePage() {
  const { isAuthenticated } = useAuth();

  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => apiRequest<HealthResponse>('/health'),
    retry: false,
  });

  return (
    <div className="space-y-10">
      <section className="mx-auto max-w-3xl space-y-5 pt-4 text-center">
        <div className="flex justify-center">
          <Badge tone={health?.status === 'ok' ? 'success' : 'neutral'}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {health?.status === 'ok'
              ? 'Система и база данных работают'
              : 'Учебная платформа управления проектами'}
          </Badge>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Совместное планирование учебных проектов в {APP_CONFIG.appName}
        </h1>

        <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600">
          Единое рабочее пространство для преподавателей и студентов: создавайте
          проекты, распределяйте задачи на канбан-доске, контролируйте дедлайны
          и обсуждайте решения без потери информации в мессенджерах.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button>
                Перейти в личный кабинет
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/register">
                <Button>
                  Создать аккаунт
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary">Войти в систему</Button>
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <FolderKanban className="h-5 w-5 text-slate-800" />
          <h2 className="mt-3 text-sm font-semibold text-slate-900">
            Проекты преподавателей
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Преподаватель создаёт учебный проект и автоматически становится его
            руководителем.
          </p>
        </Card>

        <Card className="p-5">
          <Users className="h-5 w-5 text-slate-800" />
          <h2 className="mt-3 text-sm font-semibold text-slate-900">
            Гибкие роли в проекте
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Разделение прав для руководителя, участников команды и наблюдателей.
          </p>
        </Card>

        <Card className="p-5">
          <KanbanSquare className="h-5 w-5 text-slate-800" />
          <h2 className="mt-3 text-sm font-semibold text-slate-900">
            Канбан-доска с 6 статусами
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Прозрачный путь задачи от создания до проверки и завершения с
            контролем просрочек.
          </p>
        </Card>

        <Card className="p-5">
          <ShieldCheck className="h-5 w-5 text-slate-800" />
          <h2 className="mt-3 text-sm font-semibold text-slate-900">
            Изоляция и безопасность
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Серверные сессии, шифрование паролей Argon2id и строгая проверка
            доступа к каждому проекту.
          </p>
        </Card>
      </section>
    </div>
  );
}
