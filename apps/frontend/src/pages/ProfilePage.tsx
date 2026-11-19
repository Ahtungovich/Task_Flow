import { KeyRound, User } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { authApi } from '../features/auth/authApi';
import { ApiError } from '../shared/api/client';
import { ACCOUNT_TYPE_LABELS } from '../shared/types/domain';
import { Alert } from '../shared/ui/Alert';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { Input } from '../shared/ui/Input';
import { Spinner } from '../shared/ui/Spinner';

export function ProfilePage() {
  const { user, setUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [profileMsg, setProfileMsg] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);

    try {
      const res = await authApi.updateProfile({
        fullName,
        username,
        avatar: avatar.trim() === '' ? null : avatar.trim(),
      });
      setUser(res.user);
      setProfileMsg({
        tone: 'success',
        text: 'Данные профиля успешно обновлены.',
      });
    } catch (err) {
      setProfileMsg({
        tone: 'error',
        text:
          err instanceof ApiError
            ? err.message
            : 'Не удалось обновить профиль.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmNewPassword) {
      setPasswordMsg({
        tone: 'error',
        text: 'Новый пароль и подтверждение не совпадают.',
      });
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordMsg({
        tone: 'success',
        text: 'Пароль успешно изменён.',
      });
    } catch (err) {
      setPasswordMsg({
        tone: 'error',
        text:
          err instanceof ApiError
            ? err.message
            : 'Не удалось изменить пароль.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Профиль пользователя
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Управление личными данными и безопасностью учётной записи.
        </p>
      </div>

      {/* Сводка аккаунта */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.fullName}
                className="h-12 w-12 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-base font-semibold text-white">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {user.fullName}
              </h2>
              <p className="text-xs text-slate-500">
                {user.email} · @{user.username}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={user.accountType === 'TEACHER' ? 'success' : 'neutral'}
            >
              {ACCOUNT_TYPE_LABELS[user.accountType]}
            </Badge>
            {user.accountType === 'TEACHER' && (
              <Badge tone={user.isTeacherVerified ? 'success' : 'warning'}>
                {user.isTeacherVerified
                  ? 'Статус подтверждён'
                  : 'Ожидает подтверждения'}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Основные данные */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <User className="h-4 w-4 text-slate-700" />
          <h2 className="text-base font-semibold text-slate-900">
            Личные данные
          </h2>
        </div>

        <form onSubmit={handleProfileSubmit} className="mt-4 space-y-4">
          <Input
            label="Электронная почта"
            value={user.email}
            disabled
            hint="Email используется для входа и не изменяется."
          />

          <Input
            label="Имя и фамилия"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
            maxLength={120}
          />

          <Input
            label="Имя пользователя (логин)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={32}
          />

          <Input
            label="Ссылка на аватар (необязательно)"
            type="url"
            placeholder="https://example.com/avatar.jpg"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
          />

          {profileMsg && (
            <Alert tone={profileMsg.tone}>{profileMsg.text}</Alert>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={savingProfile}>
              {savingProfile && <Spinner />}
              Сохранить изменения
            </Button>
          </div>
        </form>
      </Card>

      {/* Смена пароля */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <KeyRound className="h-4 w-4 text-slate-700" />
          <h2 className="text-base font-semibold text-slate-900">
            Изменение пароля
          </h2>
        </div>

        <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
          <Input
            label="Текущий пароль"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <Input
            label="Новый пароль"
            type="password"
            placeholder="Минимум 8 символов"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
          />

          <Input
            label="Повторите новый пароль"
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            required
            minLength={8}
          />

          {passwordMsg && (
            <Alert tone={passwordMsg.tone}>{passwordMsg.text}</Alert>
          )}

          <div className="flex justify-end">
            <Button type="submit" variant="secondary" disabled={savingPassword}>
              {savingPassword && <Spinner />}
              Обновить пароль
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
