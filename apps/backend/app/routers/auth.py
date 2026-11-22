from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import AccountType, User, UserSession
from app.schemas import LoginRequest, RegisterRequest, serialize_user
from app.security import (
    SESSION_COOKIE_NAME,
    clear_session_cookie,
    create_user_session,
    hash_password,
    hash_session_token,
    set_session_cookie,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    # приводим почту к нижнему регистру и убираем лишние пробелы по краям
    normalized_email = payload.email.strip().lower()
    normalized_username = payload.username.strip()
    normalized_full_name = payload.fullName.strip()

    # проверяем не занята ли уже эта почта
    existing_email = db.execute(
        select(User).where(User.email == normalized_email)
    ).scalar_one_or_none()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким адресом электронной почты уже зарегистрирован.",
        )

    # проверяем уникальность логина без учета заглавных и строчных букв
    existing_username = db.execute(
        select(User).where(func.lower(User.username) == normalized_username.lower())
    ).scalar_one_or_none()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Это имя пользователя уже занято.",
        )

    # определяем кого регистрируем преподавателя или студента
    account_type = (
        AccountType.TEACHER
        if payload.accountType == "TEACHER"
        else AccountType.STUDENT
    )

    # создаем запись пользователя с захешированным паролем
    user = User(
        email=normalized_email,
        username=normalized_username,
        full_name=normalized_full_name,
        password_hash=hash_password(payload.password),
        account_type=account_type,
        is_teacher_verified=(
            settings.auto_approve_teachers
            if account_type == AccountType.TEACHER
            else False
        ),
        email_verified=not settings.email_verification_required,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # сразу после регистрации создаем сессию и ставим куку чтобы не заставлять логиниться повторно
    raw_token, expires_at = create_user_session(
        db=db,
        user=user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    set_session_cookie(response, raw_token, expires_at)

    return {"user": serialize_user(user)}


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    identifier = payload.login.strip()

    # ищем пользователя сразу и по email и по username чтобы войти можно было любым способом
    user = db.execute(
        select(User).where(
            or_(
                User.email == identifier.lower(),
                func.lower(User.username) == identifier.lower(),
            )
        )
    ).scalar_one_or_none()

    # если пользователь не найден или пароль не подошел возвращаем общую ошибку
    if not user or not verify_password(user.password_hash, payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль.",
        )

    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваш аккаунт заблокирован.",
        )

    # создаем новую сессию в базе и записываем токен в httponly куку
    raw_token, expires_at = create_user_session(
        db=db,
        user=user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    set_session_cookie(response, raw_token, expires_at)

    return {"user": serialize_user(user)}


@router.post("/logout")
def logout(
    response: Response,
    taskflow_sid: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> dict:
    # удаляем текущую сессию из базы данных и стираем куку в браузере
    if taskflow_sid:
        token_hash = hash_session_token(taskflow_sid)
        db.execute(delete(UserSession).where(UserSession.token_hash == token_hash))
        db.commit()

    clear_session_cookie(response)
    return {"success": True}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)) -> dict:
    # отдаем фронтенду данные текущего авторизованного пользователя
    return {"user": serialize_user(current_user)}
