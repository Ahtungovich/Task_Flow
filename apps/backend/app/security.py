import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Response
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User, UserSession, utc_now

# имя куки в которой браузер хранит идентификатор сессии
SESSION_COOKIE_NAME = "taskflow_sid"

# инициализируем хешер паролей на алгоритме argon2id
_password_hasher = PasswordHasher()


def hash_password(plain_password: str) -> str:
    # превращаем обычный пароль в надежный хеш с солью перед сохранением в бд
    return _password_hasher.hash(plain_password)


def verify_password(password_hash: str, plain_password: str) -> bool:
    # сверяем введенный пользователем пароль с хешем из базы
    try:
        return _password_hasher.verify(password_hash, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def hash_session_token(raw_token: str) -> str:
    # хешируем токен сессии через sha256 с добавлением секретного ключа из .env
    payload = f"{raw_token}:{settings.session_secret}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def create_user_session(
    db: Session,
    user: User,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> tuple[str, datetime]:
    # генерируем случайный длинный токен который отдадим в cookie
    raw_token = secrets.token_hex(32)
    token_hash = hash_session_token(raw_token)
    expires_at = utc_now() + timedelta(hours=settings.session_ttl_hours)

    # записываем новую сессию в таблицу sessions
    db_session = UserSession(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=user_agent[:500] if user_agent else None,
        ip_address=ip_address[:64] if ip_address else None,
    )
    db.add(db_session)
    db.commit()

    return raw_token, expires_at


def set_session_cookie(
    response: Response, raw_token: str, expires_at: datetime
) -> None:
    # ставим защищенную httponly куку чтобы js на фронтенде не мог ее украсть
    expires_aware = expires_at.replace(tzinfo=timezone.utc)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        expires=expires_aware,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    # удаляем куку из браузера при выходе из аккаунта
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )
