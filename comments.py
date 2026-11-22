from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import ProjectAccessContext, get_current_user, get_project_access
from app.models import Comment, ProjectRole, Task, User, utc_now
from app.schemas import CreateCommentRequest, serialize_comment

router = APIRouter(
    prefix="/projects/{project_id}/tasks/{task_id}/comments",
    tags=["Task comments"],
)


def _get_task_or_404(db: Session, project_id: UUID, task_id: UUID) -> Task:
    task = db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.project_id == project_id,
            Task.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if task is None:
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
    """Возвращает ленту неудалённых комментариев задачи по времени создания."""
    _get_task_or_404(db, ctx.project.id, task_id)
    comments = db.execute(
        select(Comment)
        .options(joinedload(Comment.author))
        .where(Comment.task_id == task_id, Comment.deleted_at.is_(None))
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    ).unique().scalars().all()
    return {"comments": [serialize_comment(comment) for comment in comments]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_comment(
    task_id: UUID,
    payload: CreateCommentRequest,
    ctx: ProjectAccessContext = Depends(get_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Любой участник проекта, включая наблюдателя, может написать комментарий."""
    _get_task_or_404(db, ctx.project.id, task_id)
    text = payload.text.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Комментарий не может быть пустым.",
        )

    comment = Comment(task_id=task_id, author_id=current_user.id, text=text)
    db.add(comment)
    db.commit()

    created = db.execute(
        select(Comment)
        .options(joinedload(Comment.author))
        .where(Comment.id == comment.id)
    ).unique().scalar_one()
    return {"comment": serialize_comment(created)}


@router.delete("/{comment_id}")
def delete_comment(
    task_id: UUID,
    comment_id: UUID,
    ctx: ProjectAccessContext = Depends(get_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Автор удаляет свой комментарий; руководитель может удалить любой."""
    _get_task_or_404(db, ctx.project.id, task_id)
    comment = db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.task_id == task_id,
            Comment.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Комментарий не найден.",
        )

    is_author = comment.author_id == current_user.id
    is_leader = ctx.role == ProjectRole.LEADER
    if not (is_author or is_leader):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Удалить комментарий может только его автор или руководитель проекта.",
        )

    comment.deleted_at = utc_now()
    db.commit()
    return {"message": "Комментарий удалён."}
