from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import (
    ProjectAccessContext,
    get_current_user,
    get_project_access,
    require_project_leader,
)
from app.models import (
    Label,
    ProjectMembership,
    ProjectRole,
    Task,
    TaskLabel,
    TaskPriority,
    TaskStatus,
    User,
    utc_now,
)
from app.schemas import (
    CreateLabelRequest,
    CreateTaskRequest,
    UpdateTaskRequest,
    UpdateTaskStatusRequest,
    parse_optional_datetime,
    serialize_label,
    serialize_task,
)

router = APIRouter(prefix="/projects/{project_id}", tags=["Tasks & Labels"])


def _task_query_with_relations(project_id: UUID):
    # базовый запрос который сразу подгружает автора исполнителя метки и комментарии задачи
    return (
        select(Task)
        .options(
            joinedload(Task.author),
            joinedload(Task.assignee),
            joinedload(Task.task_labels).joinedload(TaskLabel.label),
            joinedload(Task.comments),
        )
        .where(Task.project_id == project_id, Task.deleted_at.is_(None))
    )


def _ensure_assignee_in_project(
    db: Session, project_id: UUID, assignee_id: UUID
) -> None:
    # проверяем что выбранный исполнитель действительно состоит в этом проекте
    membership = db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == assignee_id,
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Исполнителем можно назначить только участника данного проекта.",
        )


def _validate_project_labels(
    db: Session, project_id: UUID, label_ids: list[UUID]
) -> list[UUID]:
    # убираем дубликаты id меток и проверяем что все они принадлежат именно этому проекту
    unique_ids = list(dict.fromkeys(label_ids))
    if not unique_ids:
        return []

    found_ids = db.execute(
        select(Label.id).where(
            Label.project_id == project_id,
            Label.id.in_(unique_ids),
        )
    ).scalars().all()

    if len(found_ids) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Одна или несколько выбранных меток не принадлежат этому проекту.",
        )
    return unique_ids


@router.get("/tasks")
def list_tasks(
    ctx: ProjectAccessContext = Depends(get_project_access),
    db: Session = Depends(get_db),
) -> dict:
    # получаем все активные задачи проекта отсортированные по статусу и позиции на доске
    stmt = _task_query_with_relations(ctx.project.id).order_by(
        Task.status.asc(), Task.position.asc(), Task.created_at.desc()
    )
    tasks = db.execute(stmt).unique().scalars().all()
    return {"tasks": [serialize_task(t) for t in tasks]}


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
def create_task(
    payload: CreateTaskRequest,
    ctx: ProjectAccessContext = Depends(get_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # наблюдатель может только смотреть доску создавать задачи ему нельзя
    if ctx.role == ProjectRole.OBSERVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Наблюдатель не может создавать задачи.",
        )

    # обычный участник может создать задачу но назначать исполнителя вправе только руководитель
    if ctx.role == ProjectRole.MEMBER and payload.assigneeId is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только руководитель проекта может назначать исполнителей задач.",
        )

    if payload.assigneeId is not None:
        _ensure_assignee_in_project(db, ctx.project.id, payload.assigneeId)

    try:
        start_date = parse_optional_datetime(payload.startDate)
        deadline = parse_optional_datetime(payload.deadline)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    # дедлайн не может быть раньше даты начала задачи
    if start_date and deadline and deadline < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дедлайн не может быть раньше даты начала задачи.",
        )

    valid_label_ids = (
        _validate_project_labels(db, ctx.project.id, payload.labelIds)
        if payload.labelIds
        else []
    )

    # вычисляем позицию в конце нужной колонки чтобы карточка встала последней
    target_status = payload.status or TaskStatus.NEW
    max_pos = db.execute(
        select(func.max(Task.position)).where(
            Task.project_id == ctx.project.id,
            Task.status == target_status,
            Task.deleted_at.is_(None),
        )
    ).scalar()
    next_position = (max_pos if max_pos is not None else -1) + 1

    # создаем задачу в базе данных
    task = Task(
        project_id=ctx.project.id,
        author_id=current_user.id,
        assignee_id=payload.assigneeId,
        title=payload.title.strip(),
        description=(payload.description or "").strip(),
        status=target_status,
        priority=payload.priority or TaskPriority.MEDIUM,
        position=next_position,
        start_date=start_date,
        deadline=deadline,
    )
    db.add(task)
    db.flush()

    # привязываем выбранные цветные метки к задаче
    for lbl_id in valid_label_ids:
        db.add(TaskLabel(task_id=task.id, label_id=lbl_id))

    db.commit()

    created = (
        db.execute(
            _task_query_with_relations(ctx.project.id).where(Task.id == task.id)
        )
        .unique()
        .scalar_one()
    )
    return {"task": serialize_task(created)}


@router.get("/tasks/{task_id}")
def get_task(
    task_id: UUID,
    ctx: ProjectAccessContext = Depends(get_project_access),
    db: Session = Depends(get_db),
) -> dict:
    # достаем одну конкретную задачу по ее id внутри текущего проекта
    task = (
        db.execute(
            _task_query_with_relations(ctx.project.id).where(Task.id == task_id)
        )
        .unique()
        .scalar_one_or_none()
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задача не найдена в этом проекте.",
        )
    return {"task": serialize_task(task)}


@router.patch("/tasks/{task_id}")
def update_task(
    task_id: UUID,
    payload: UpdateTaskRequest,
    ctx: ProjectAccessContext = Depends(get_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if ctx.role == ProjectRole.OBSERVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Наблюдатель не может редактировать задачи.",
        )

    task = db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.project_id == ctx.project.id,
            Task.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задача не найдена в этом проекте.",
        )

    is_leader = ctx.role == ProjectRole.LEADER
    is_author = task.author_id == current_user.id

    # участник может редактировать только те задачи которые создал сам
    if not is_leader and not is_author:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Участник может редактировать только собственные задачи (созданные им самим).",
        )

    fields_set = payload.model_fields_set

    # менять исполнителя задачи разрешено только руководителю проекта
    if not is_leader and "assigneeId" in fields_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только руководитель проекта может назначать или изменять исполнителя задачи.",
        )

    if "assigneeId" in fields_set and payload.assigneeId is not None:
        _ensure_assignee_in_project(db, ctx.project.id, payload.assigneeId)

    try:
        new_start = (
            parse_optional_datetime(payload.startDate)
            if "startDate" in fields_set
            else task.start_date
        )
        new_deadline = (
            parse_optional_datetime(payload.deadline)
            if "deadline" in fields_set
            else task.deadline
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    if new_start and new_deadline and new_deadline < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дедлайн не может быть раньше даты начала задачи.",
        )

    # точечно обновляем только те поля которые пришли в запросе
    if "title" in fields_set and payload.title is not None:
        task.title = payload.title.strip()
    if "description" in fields_set and payload.description is not None:
        task.description = payload.description.strip()
    if "assigneeId" in fields_set:
        task.assignee_id = payload.assigneeId
    if "priority" in fields_set and payload.priority is not None:
        task.priority = payload.priority
    if "status" in fields_set and payload.status is not None:
        task.status = payload.status
    if "position" in fields_set and payload.position is not None:
        task.position = payload.position
    if "startDate" in fields_set:
        task.start_date = new_start
    if "deadline" in fields_set:
        task.deadline = new_deadline

    # если передали новый список меток перезаписываем связи в таблице task_labels
    if "labelIds" in fields_set and payload.labelIds is not None:
        valid_label_ids = _validate_project_labels(
            db, ctx.project.id, payload.labelIds
        )
        db.execute(delete(TaskLabel).where(TaskLabel.task_id == task.id))
        for lbl_id in valid_label_ids:
            db.add(TaskLabel(task_id=task.id, label_id=lbl_id))

    db.add(task)
    db.commit()

    updated = (
        db.execute(
            _task_query_with_relations(ctx.project.id).where(Task.id == task.id)
        )
        .unique()
        .scalar_one()
    )
    return {"task": serialize_task(updated)}


@router.patch("/tasks/{task_id}/status")
def update_task_status(
    task_id: UUID,
    payload: UpdateTaskStatusRequest,
    ctx: ProjectAccessContext = Depends(get_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # отдельный быстрый метод для перетаскивания карточек между колонками канбан-доски
    if ctx.role == ProjectRole.OBSERVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Наблюдатель не может изменять статус задач.",
        )

    task = db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.project_id == ctx.project.id,
            Task.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задача не найдена в этом проекте.",
        )

    is_leader = ctx.role == ProjectRole.LEADER
    is_assignee = task.assignee_id == current_user.id
    is_author_unassigned = (
        task.author_id == current_user.id and task.assignee_id is None
    )

    # руководитель двигает любые задачи а участник только свои или назначенные ему
    if not is_leader and not is_assignee and not is_author_unassigned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы можете изменять статус только назначенных вам задач.",
        )

    task.status = payload.status
    if payload.position is not None:
        task.position = payload.position

    db.add(task)
    db.commit()

    updated = (
        db.execute(
            _task_query_with_relations(ctx.project.id).where(Task.id == task.id)
        )
        .unique()
        .scalar_one()
    )
    return {"task": serialize_task(updated)}


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: UUID,
    ctx: ProjectAccessContext = Depends(get_project_access),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    if ctx.role == ProjectRole.OBSERVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Наблюдатель не может удалять задачи.",
        )

    task = db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.project_id == ctx.project.id,
            Task.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задача не найдена в этом проекте.",
        )

    is_leader = ctx.role == ProjectRole.LEADER
    is_author = task.author_id == current_user.id

    # участник может удалить только задачу созданную им самим
    if not is_leader and not is_author:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Участник может удалять только собственные задачи (созданные им самим).",
        )

    # делаем мягкое удаление проставляя текущее время в поле deleted_at
    task.deleted_at = utc_now()
    db.add(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ==========================================
# управление цветными метками проекта (labels)
# ==========================================


@router.get("/labels")
def list_labels(
    ctx: ProjectAccessContext = Depends(get_project_access),
    db: Session = Depends(get_db),
) -> dict:
    # возвращаем все метки проекта по алфавиту
    labels = db.execute(
        select(Label)
        .where(Label.project_id == ctx.project.id)
        .order_by(Label.name.asc())
    ).scalars().all()
    return {"labels": [serialize_label(lbl) for lbl in labels]}


@router.post("/labels", status_code=status.HTTP_201_CREATED)
def create_label(
    payload: CreateLabelRequest,
    ctx: ProjectAccessContext = Depends(require_project_leader),
    db: Session = Depends(get_db),
) -> dict:
    # создавать метки может только руководитель проекта
    normalized_name = payload.name.strip()
    existing = db.execute(
        select(Label).where(
            Label.project_id == ctx.project.id,
            func.lower(Label.name) == normalized_name.lower(),
        )
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Метка с таким названием уже есть в проекте.",
        )

    label = Label(
        project_id=ctx.project.id,
        name=normalized_name,
        color=payload.color or "#475569",
    )
    db.add(label)
    db.commit()
    db.refresh(label)
    return {"label": serialize_label(label)}


@router.delete("/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_label(
    label_id: UUID,
    ctx: ProjectAccessContext = Depends(require_project_leader),
    db: Session = Depends(get_db),
) -> Response:
    # удаляем метку из проекта (из задач она отвяжется автоматически по каскаду)
    label = db.execute(
        select(Label).where(
            Label.id == label_id,
            Label.project_id == ctx.project.id,
        )
    ).scalar_one_or_none()

    if not label:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Метка не найдена в этом проекте.",
        )

    db.delete(label)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
