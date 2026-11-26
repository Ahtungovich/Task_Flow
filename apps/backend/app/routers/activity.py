# !! Добавлен новый модуль роутера для просмотра журнала истории изменений (логов) проекта (Этап 11)
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import ProjectAccessContext, get_project_access
from app.models import ActivityLog
from app.schemas import serialize_activity_log

router = APIRouter(tags=["Activity"])


@router.get("/projects/{project_id}/activity")
def list_project_activity(
    entityType: Optional[str] = Query(default=None),
    taskId: Optional[UUID] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
    ctx: ProjectAccessContext = Depends(get_project_access),
    db: Session = Depends(get_db),
) -> dict:
    # Возвращаем отсортированный по убыванию времени список событий в проекте
    # с возможностью фильтрации по типу сущности (TASK, MEMBER, ATTACHMENT, PROJECT, COMMENT, LABEL)
    filters = [ActivityLog.project_id == ctx.project.id]

    if entityType and entityType.upper() != "ALL":
        filters.append(ActivityLog.entity_type == entityType.upper())

    if taskId:
        filters.append(ActivityLog.task_id == taskId)

    total = (
        db.execute(select(func.count(ActivityLog.id)).where(*filters)).scalar()
        or 0
    )

    stmt = (
        select(ActivityLog)
        .options(joinedload(ActivityLog.actor))
        .where(*filters)
        .order_by(ActivityLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = db.execute(stmt).scalars().all()

    return {
        "logs": [serialize_activity_log(item) for item in items],
        "total": total,
    }
