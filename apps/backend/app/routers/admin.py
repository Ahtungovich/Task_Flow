from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models import AccountType, Project, User
from app.schemas import VerifyTeacherRequest, serialize_teacher_application

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin)],
)


@router.get("/teachers")
def list_teachers(
    status_filter: Literal["all", "pending", "verified"] = Query(
        default="all", alias="status"
    ),
    db: Session = Depends(get_db),
) -> dict:
    # загружаем всех пользователей с ролью преподавателя сначала неподтвержденных
    all_teachers = (
        db.execute(
            select(User)
            .where(User.account_type == AccountType.TEACHER)
            .order_by(User.is_teacher_verified.asc(), User.created_at.desc())
        )
        .scalars()
        .all()
    )

    # считаем сколько проектов создал каждый преподаватель
    project_counts_rows = db.execute(
        select(Project.creator_id, func.count(Project.id)).group_by(Project.creator_id)
    ).all()
    projects_by_creator = {row[0]: int(row[1]) for row in project_counts_rows}

    total_count = len(all_teachers)
    pending_count = sum(1 for t in all_teachers if not t.is_teacher_verified)
    verified_count = total_count - pending_count

    # применяем выбранный фильтр статуса заявки
    if status_filter == "pending":
        filtered_teachers = [t for t in all_teachers if not t.is_teacher_verified]
    elif status_filter == "verified":
        filtered_teachers = [t for t in all_teachers if t.is_teacher_verified]
    else:
        filtered_teachers = all_teachers

    return {
        "teachers": [
            serialize_teacher_application(t, projects_by_creator.get(t.id, 0))
            for t in filtered_teachers
        ],
        "stats": {
            "total": total_count,
            "pending": pending_count,
            "verified": verified_count,
        },
    }


@router.patch("/teachers/{user_id}/verify")
def verify_teacher(
    user_id: UUID,
    payload: VerifyTeacherRequest,
    db: Session = Depends(get_db),
) -> dict:
    # ищем пользователя по идентификатору
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден.",
        )

    # подтверждать или отзывать верификацию можно только у аккаунта преподавателя
    if target_user.account_type != AccountType.TEACHER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Указанный пользователь не является преподавателем.",
        )

    target_user.is_teacher_verified = payload.verified
    db.add(target_user)
    db.commit()
    db.refresh(target_user)

    projects_count = (
        db.execute(
            select(func.count(Project.id)).where(Project.creator_id == target_user.id)
        ).scalar_one()
        or 0
    )

    return {
        "teacher": serialize_teacher_application(target_user, int(projects_count))
    }
