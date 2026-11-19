import { GraduationCap, UserCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { ApiError } from '../shared/api/client';
import { Alert } from '../shared/ui/Alert';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { Input } from '../shared/ui/Input';
import { Spinner } from '../shared/ui/Spinner';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [accountType, setAccountType] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        email,
        username,
        fullName,
        password,
        accountType,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Не удалось завершить регистрацию. Попробуйте ещё раз.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6 sm:p-8">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-slate-900">Регистрация</h1>
          <p className="text-sm text-slate-600">
            Выберите тип аккаунта и заполните данные для входа в систему.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-700">
              Тип аккаунта
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setAccountType('STUDENT')}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                  accountType === 'STUDENT'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                <span className="mt-1.5 text-sm font-medium">Студент</span>
                <span
                  className={`mt-0.5 text-[11px] ${
                    accountType === 'STUDENT' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Участие в проектах
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAccountType('TEACHER')}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                  accountType === 'TEACHER'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <span className="mt-1.5 text-sm font-medium">Преподаватель</span>
                <span
                  className={`mt-0.5 text-[11px] ${
                    accountType === 'TEACHER' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Создание проектов
                </span>
              </button>
            </div>
          </div>

          <Input
            label="Имя и фамилия"
            name="fullName"
            placeholder="Иван Петров"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
            maxLength={120}
          />

          <Input
            label="Имя пользователя (логин)"
            name="username"
            placeholder="ivan_petrov"
            hint="Латинские буквы, цифры, точка, дефис или подчёркивание (от 3 символов)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={32}
          />

          <Input
            label="Электронная почта"
            name="email"
            type="email"
            placeholder="student@university.ru"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Пароль"
            name="password"
            type="password"
            placeholder="Минимум 8 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
          />

          <Input
            label="Подтверждение пароля"
            name="confirmPassword"
            type="password"
            placeholder="Повторите пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />

          {error && <Alert tone="error">{error}</Alert>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Spinner />}
            Зарегистрироваться
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Уже есть аккаунт?{' '}
          <Link
            to="/login"
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            Войти
          </Link>
        </p>
      </Card>
    </div>
  );
}
