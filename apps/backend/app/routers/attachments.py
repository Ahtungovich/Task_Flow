# !! Добавлен новый модуль роутера для загрузки, списка, скачивания и удаления файлов (Этап 10)
# Поддерживает два уровня прикрепления файлов:
# 1) На уровень всего проекта (/projects/{project_id}/attachments)
# 2) На уровень конкретной задачи (/projects/{project_id}/tasks/{task_id}/attachments)
# Скачивание и удаление работают по единому ID вложения с обязательной проверкой прав доступа к проекту.
import uuid
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import (
    ProjectAccessContext,
    get_current_user,
    get_project_access,
)
from app.models import (
    Attachment,
    ProjectMembership,
    ProjectRole,
    Task,
    User,
    utc_now,
)
from app.schemas import serialize_attachment

router = APIRouter(tags=["Attachments"])

# !! Определяем папку для локального хранения загруженных файлов (apps/backend/uploads) и лимит размера 20 МБ
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = _BACKEND_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 МБ на один файл


def _ensure_can_upload(ctx: ProjectAccessContext) -> None:
    # Наблюдатель может только просматривать и скачивать файлы, но не загружать новые
    if ctx.role == ProjectRole.OBSERVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Наблюдатель не может прикреплять файлы.",
        )


def _get_active_task_or_404(
    db: Session, project_id: UUID, task_id: UUID
) -> Task:
    # Проверяем что задача существует в указанном проекте и не помечена как удалённая
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
            detail="Задача не найдена.",
        )
    return task


async def _save_uploaded_file(
    db: Session,
    project_id: UUID,
    task_id: Optional[UUID],
    uploader: User,
    upload: UploadFile,
) -> Attachment:
    # Читаем содержимое загруженного файла и проверяем что он не пустой и не превышает 20 МБ
    original_name = (upload.filename or "").strip()
    if not original_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя загружаемого файла не определено.",
        )

    content = await upload.read()
    size_bytes = len(content)

    if size_bytes == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя прикрепить пустой файл (0 байт).",
        )

    if size_bytes > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Размер файла превышает максимально допустимые 20 МБ.",
        )

    # Генерируем безопасное имя на диске из UUID + исходного расширения файла (например .pdf, .docx, .zip)
    suffix = Path(original_name).suffix[:20]
    stored_name = f"{uuid.uuid4()}{suffix}"
    target_path = UPLOADS_DIR / stored_name
    target_path.write_bytes(content)

    attachment = Attachment(
        project_id=project_id,
        task_id=task_id,
        uploader_id=uploader.id,
        original_name=Path(original_name).name[:255],
        stored_name=stored_name,
        content_type=upload.content_type or "application/octet-stream",
        size_bytes=size_bytes,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    # Подгружаем данные автора загрузки для корректной сериализации
    attachment.uploader = uploader
    return attachment


# ==========================================
# Файлы уровня проекта
# ==========================================


@router.get("/projects/{project_id}/attachments")
def list_project_attachments(
    ctx: ProjectAccessContext = Depends(get_project_access),
    db: Session = Depends(get_db),
) -> dict:
    # Возвращаем список файлов, прикреплённых непосредственно к проекту (где task_id IS NULL)
    stmt = (
        select(Attachment)
        .options(joinedload(Attachment.uploader))
        .where(
            Attachment.project_id == ctx.project.id,
            Attachment.task_id.is_(None),
            Attachment.deleted_at.is_(None),
        )
        .order_by(Attachment.created_at.desc())
    )
    items = db.execute(stmt).scalars().all()
    return {"attachments": [serialize_attachment(item) for item in items]}


@router.post(
    "/projects/{project_id}/attachments",
    status_code=status.HTTP_201_CREATED,
)
async def upload_project_attachment(
    file: UploadFile = File(...),
    ctx: ProjectAccessContext = Depends(get_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # Загружаем новый файл в материалы проекта (доступно руководителю и участникам)
    _ensure_can_upload(ctx)
    attachment = await _save_uploaded_file(
        db=db,
        project_id=ctx.project.id,
        task_id=None,
        uploader=current_user,
        upload=file,
    )
    return {"attachment": serialize_attachment(attachment)}


# ==========================================
# Файлы уровня конкретной задачи
# ==========================================


@router.get("/projects/{project_id}/tasks/{task_id}/attachments")
def list_task_attachments(
    task_id: UUID,
    ctx: ProjectAccessContext = Depends(get_project_access),
    db: Session = Depends(get_db),
) -> dict:
    # Возвращаем список файлов, прикреплённых к конкретной задаче
    _get_active_task_or_404(db, ctx.project.id, task_id)
    stmt = (
        select(Attachment)
        .options(joinedload(Attachment.uploader))
        .where(
            Attachment.project_id == ctx.project.id,
            Attachment.task_id == task_id,
            Attachment.deleted_at.is_(None),
        )
        .order_by(Attachment.created_at.desc())
    )
    items = db.execute(stmt).scalars().all()
    return {"attachments": [serialize_attachment(item) for item in items]}


@router.post(
    "/projects/{project_id}/tasks/{task_id}/attachments",
    status_code=status.HTTP_201_CREATED,
)
async def upload_task_attachment(
    task_id: UUID,
    file: UploadFile = File(...),
    ctx: ProjectAccessContext = Depends(get_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # Прикрепляем файл к выбранной задаче (доступно руководителю и участникам)
    _ensure_can_upload(ctx)
    _get_active_task_or_404(db, ctx.project.id, task_id)
    attachment = await _save_uploaded_file(
        db=db,
        project_id=ctx.project.id,
        task_id=task_id,
        uploader=current_user,
        upload=file,
    )
    return {"attachment": serialize_attachment(attachment)}


# ==========================================
# Скачивание и удаление вложения по его ID
# ==========================================


def _get_attachment_and_check_member(
    db: Session, attachment_id: UUID, current_user: User
) -> tuple[Attachment, ProjectMembership]:
    # Находим вложение и проверяем, что текущий пользователь является участником его проекта
    attachment = db.execute(
        select(Attachment)
        .options(joinedload(Attachment.project))
        .where(
            Attachment.id == attachment_id,
            Attachment.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден или был удалён.",
        )

    membership = db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == attachment.project_id,
            ProjectMembership.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет доступа к файлам этого проекта.",
        )

    return attachment, membership


@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    # Отдаём файл на скачивание с исходным именем файла (Content-Disposition: attachment)
    attachment, _ = _get_attachment_and_check_member(db, attachment_id, current_user)
    file_path = UPLOADS_DIR / attachment.stored_name

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Физический файл не найден на сервере.",
        )

    return FileResponse(
        path=str(file_path),
        filename=attachment.original_name,
        media_type=attachment.content_type,
    )


@router.delete("/attachments/{attachment_id}")
def delete_attachment(
    attachment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # Удалить файл может только тот, кто его загрузил, либо руководитель проекта
    attachment, membership = _get_attachment_and_check_member(
        db, attachment_id, current_user
    )

    is_leader = (
        attachment.project.leader_id == current_user.id
        or membership.role == ProjectRole.LEADER
    )
    is_uploader = attachment.uploader_id == current_user.id

    if not (is_leader or is_uploader):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Удалить файл может только его автор или руководитель проекта.",
        )

    attachment.deleted_at = utc_now()
    db.add(attachment)
    db.commit()

    # Удаляем физический файл с диска чтобы не занимать лишнее место
    file_path = UPLOADS_DIR / attachment.stored_name
    if file_path.exists():
        file_path.unlink(missing_ok=True)

    return {"success": True}
