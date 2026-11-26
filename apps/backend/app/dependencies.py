from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    AccountType,
    Project,
    ProjectMembership,
    ProjectRole,
    User,
    UserSession,
    utc_now,
)
from app.security import SESSION_COOKIE_NAME, hash_session_token


# удобный контейнер чтобы передавать в роуты сам проект и роль текущего юзера в нем
@dataclass
class ProjectAccessContext:
    project: Project
    role: ProjectRole


def get_current_user(
    taskflow_sid: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    # достаем токен из куки и проверяем что пользователь залогинен
    if not taskflow_sid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация.",
        )

    # ищем сессию в базе по хешу токена и сразу подгружаем пользователя
    token_hash = hash_session_token(taskflow_sid)
    stmt = (
        select(UserSession)
        .options(joinedload(UserSession.user))
        .where(UserSession.token_hash == token_hash)
    )
    session_obj = db.execute(stmt).scalar_one_or_none()

    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия недействительна или истекла.",
        )

    # если срок действия сессии вышел чистим ее из базы и просим войти заново
    if session_obj.expires_at <= utc_now():
        db.delete(session_obj)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия недействительна или истекла.",
        )

    user = session_obj.user
    # заблокированного пользователя никуда не пускаем
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваш аккаунт заблокирован.",
        )

    return user


def require_verified_teacher(
    current_user: User = Depends(get_current_user),
) -> User:
    # проверка для создания проектов это может делать только подтвержденный преподаватель
    if (
        current_user.account_type != AccountType.TEACHER
        or not current_user.is_teacher_verified
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Действие доступно только подтверждённым преподавателям.",
        )
    return current_user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    # проверка прав системного администратора для модерации заявок преподавателей
    if current_user.account_type != AccountType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Действие доступно только системному администратору.",
        )
    return current_user


def get_project_access(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectAccessContext:
    # проверяем существует ли проект с таким id
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден.",
        )

    # проверяем состоит ли текущий пользователь в этом проекте (изоляция чужих проектов)
    stmt = select(ProjectMembership).where(
        ProjectMembership.project_id == project_id,
        ProjectMembership.user_id == current_user.id,
    )
    membership = db.execute(stmt).scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет доступа к этому проекту.",
        )

    # если пользователь является руководителем проекта закрепляем за ним роль leader
    effective_role = (
        ProjectRole.LEADER
        if project.leader_id == current_user.id
        else membership.role
    )
    return ProjectAccessContext(project=project, role=effective_role)


def require_project_leader(
    ctx: ProjectAccessContext = Depends(get_project_access),
) -> ProjectAccessContext:
    # фильтр для действий доступных только руководителю (добавить участника удалить проект и тд)
    if ctx.role != ProjectRole.LEADER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для выполнения этого действия в проекте.",
        )
    return ctx
