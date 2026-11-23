from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import (
    ProjectAccessContext,
    get_current_user,
    get_project_access,
)
from app.models import Comment, ProjectRole, Task, User, utc_now
from app.schemas import CreateCommentRequest, serialize_comment

router = APIRouter(
    prefix="/projects/{project_id}/tasks/{task_id}/comments",
    tags=["Comments"],
)


def _get_active_task_or_404(db: Session, project_id: UUID, task_id: UUID) -> Task:
    # проверяем что задача существует в этом проекте и не была удалена
    task = db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.project_id == project_id,
            Task.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задача не найдена в этом проекте.",
        )
    return task


@router.get("")
def list_comments(
    task_id: UUID,
    ctx: ProjectAccessContext = Depends(get_project_access),
    db: Session = Depends(get_db),
) -> dict:
    # смотреть комментарии может любой участник проекта включая наблюдателя
    _get_active_task_or_404(db, ctx.project.id, task_id)

    stmt = (
        select(Comment)
        .options(joinedload(Comment.author))
        .where(
            Comment.task_id == task_id,
            Comment.deleted_at.is_(None),
        )
        .order_by(Comment.created_at.asc())
    )
    comments = db.execute(stmt).scalars().all()
    return {"comments": [serialize_comment(c) for c in comments]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_comment(
    task_id: UUID,
    payload: CreateCommentRequest,
    ctx: ProjectAccessContext = Depends(get_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # наблюдатель может только читать обсуждение писать комментарии ему нельзя
    if ctx.role == ProjectRole.OBSERVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Наблюдатель не может оставлять комментарии к задачам.",
        )

    _get_active_task_or_404(db, ctx.project.id, task_id)

    # сохраняем новый комментарий в базу данных
    comment = Comment(
        task_id=task_id,
        author_id=current_user.id,
        text=payload.text,
    )
    db.add(comment)
    db.commit()

    # подгружаем комментарий вместе с автором чтобы сразу вернуть его на фронтенд
    created = db.execute(
        select(Comment)
        .options(joinedload(Comment.author))
        .where(Comment.id == comment.id)
    ).scalar_one()

    return {"comment": serialize_comment(created)}


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    task_id: UUID,
    comment_id: UUID,
    ctx: ProjectAccessContext = Depends(get_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    # наблюдатель не может удалять комментарии
    if ctx.role == ProjectRole.OBSERVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Наблюдатель не может удалять комментарии.",
        )

    _get_active_task_or_404(db, ctx.project.id, task_id)

    comment = db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.task_id == task_id,
            Comment.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Комментарий не найден.",
        )

    is_leader = ctx.role == ProjectRole.LEADER
    is_author = comment.author_id == current_user.id

    # удалить комментарий может либо его автор либо руководитель проекта
    if not is_leader and not is_author:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы можете удалять только собственные комментарии.",
        )

    # делаем мягкое удаление проставляя дату в deleted_at
    comment.deleted_at = utc_now()
    db.add(comment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
