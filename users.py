from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProjectMembership, Task, TaskLabel, TaskStatus, User
from app.schemas import (
    ChangePasswordRequest,
    UpdateProfileRequest,
    serialize_task,
    serialize_user,
)
from app.security import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me")
def get_profile(current_user: User = Depends(get_current_user)) -> dict:
    # возвращаем профиль текущего пользователя
    return {"user": serialize_user(current_user)}


@router.get("/me/tasks")
def get_my_assigned_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Возвращает назначенные текущему пользователю задачи из всех его проектов."""
    stmt = (
        select(Task)
        .join(
            ProjectMembership,
            ProjectMembership.project_id == Task.project_id,
        )
        .options(
            joinedload(Task.author),
            joinedload(Task.assignee),
            joinedload(Task.project),
            joinedload(Task.task_labels).joinedload(TaskLabel.label),
            joinedload(Task.comments),
        )
        .where(
            ProjectMembership.user_id == current_user.id,
            Task.assignee_id == current_user.id,
            Task.deleted_at.is_(None),
        )
        .order_by(Task.deadline.asc().nulls_last(), Task.created_at.desc())
    )
    tasks = db.execute(stmt).unique().scalars().all()

    serialized = []
    for task in tasks:
        item = serialize_task(task)
        item["project"] = {
            "id": str(task.project.id),
            "name": task.project.name,
            "status": task.project.status.value,
        }
        serialized.append(item)

    active_count = sum(1 for task in tasks if task.status != TaskStatus.DONE)
    overdue_count = sum(1 for task in serialized if task["isOverdue"])
    completed_count = sum(1 for task in tasks if task.status == TaskStatus.DONE)

    return {
        "tasks": serialized,
        "summary": {
            "total": len(tasks),
            "active": active_count,
            "overdue": overdue_count,
            "completed": completed_count,
        },
    }


@router.patch("/me")
def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # смотрим какие именно поля прислал пользователь чтобы обновить только их
    fields_set = payload.model_fields_set

    if "username" in fields_set and payload.username is not None:
        # проверяем что новый логин не занят кем-то другим
        conflict = db.execute(
            select(User).where(
                User.id != current_user.id,
                func.lower(User.username) == payload.username.lower(),
            )
        ).scalar_one_or_none()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Это имя пользователя уже занято.",
            )
        current_user.username = payload.username

    if "fullName" in fields_set and payload.fullName is not None:
        current_user.full_name = payload.fullName.strip()

    if "avatar" in fields_set:
        current_user.avatar = payload.avatar

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {"user": serialize_user(current_user)}


@router.patch("/me/password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # сначала проверяем правильно ли введен старый пароль
    if not verify_password(current_user.password_hash, payload.currentPassword):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Текущий пароль указан неверно.",
        )

    # не даем поменять пароль на точно такой же
    if payload.currentPassword == payload.newPassword:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новый пароль должен отличаться от текущего.",
        )

    # хешируем новый пароль и сохраняем в базу
    current_user.password_hash = hash_password(payload.newPassword)
    db.add(current_user)
    db.commit()

    return {"success": True}
