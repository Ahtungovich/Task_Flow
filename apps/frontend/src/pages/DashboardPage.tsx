import { FolderPlus, Info, UserCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { ACCOUNT_TYPE_LABELS } from '../shared/types/domain';
import { Alert } from '../shared/ui/Alert';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';

export function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const canCreateProject =
    user.accountType === 'TEACHER' && user.isTeacherVerified;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">
              Добро пожаловать, {user.fullName}
            </h1>
            <Badge
              tone={user.accountType === 'TEACHER' ? 'success' : 'neutral'}
            >
              {ACCOUNT_TYPE_LABELS[user.accountType]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Личный кабинет пользователя @{user.username}
          </p>
        </div>

        <Link to="/profile">
          <Button variant="secondary">
            <UserCircle2 className="h-4 w-4" />
            Настройки профиля
          </Button>
        </Link>
      </div>

      <Alert tone="info">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
          <div>
            <p className="font-medium text-slate-900">
              Этап 2 активен: авторизация и профиль работают
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {canCreateProject
                ? 'У вас аккаунт подтверждённого преподавателя — на следующем этапе (Этап 3) здесь появится кнопка создания проектов и управления участниками.'
                : 'У вас аккаунт студента — создание новых проектов недоступно, на Этапе 3 здесь будут отображаться проекты, в которые вас добавит руководитель.'}
            </p>
          </div>
        </div>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Мои проекты
            </h2>
            {canCreateProject && (
              <Badge tone="success">
                <FolderPlus className="h-3.5 w-3.5" />
                Доступно с Этапа 3
              </Badge>
            )}
          </div>
          <p className="mt-3 text-sm text-slate-500">
            У вас пока нет проектов. Модуль проектов и ролей будет подключён на
            Этапе 3.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900">Мои задачи</h2>
          <p className="mt-3 text-sm text-slate-500">
            Назначенные вам задачи из всех проектов появятся здесь после
            реализации модуля задач (Этапы 4–5).
          </p>
        </Card>
      </div>
    </div>
  );
}
