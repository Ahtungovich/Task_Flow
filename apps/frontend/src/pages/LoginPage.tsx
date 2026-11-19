import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { ApiError } from '../shared/api/client';
import { Alert } from '../shared/ui/Alert';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { Input } from '../shared/ui/Input';
import { Spinner } from '../shared/ui/Spinner';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname || '/dashboard';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login({ login: loginValue, password });
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Не удалось выполнить вход. Проверьте подключение к серверу.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6 sm:p-8">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-slate-900">Вход в систему</h1>
          <p className="text-sm text-slate-600">
            Введите email или имя пользователя и пароль.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Email или имя пользователя"
            name="login"
            placeholder="ivan_petrov или user@university.ru"
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            required
          />

          <Input
            label="Пароль"
            name="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <Alert tone="error">{error}</Alert>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Spinner />}
            Войти
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Нет аккаунта?{' '}
          <Link
            to="/register"
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            Зарегистрироваться
          </Link>
        </p>
      </Card>
    </div>
  );
}
