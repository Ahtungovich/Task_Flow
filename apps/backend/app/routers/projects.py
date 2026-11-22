from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import (
    ProjectAccessContext,
    get_current_user,
    get_project_access,
    require_project_leader,
    require_verified_teacher,
)
from app.models import (
    AccountType,
    Project,
    ProjectMembership,
    ProjectRole,
    ProjectStatus,
    Task,
    User,
)
from app.schemas import (
    AddMemberRequest,
    CreateProjectRequest,
    UpdateMemberRoleRequest,
    UpdateProjectRequest,
    parse_optional_datetime,
    serialize_member,
    serialize_project_summary,
    serialize_user_short,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


def _count_active_tasks(db: Session, project_id: UUID) -> int:
    # считаем сколько в проекте неудаленных задач для отображения на карточке
    stmt = select(func.count(Task.id)).where(
        Task.project_id == project_id,
        Task.deleted_at.is_(None),
    )
    return int(db.execute(stmt).scalar() or 0)


def _count_members(db: Session, project_id: UUID) -> int:
    # считаем общее количество участников в проекте
    stmt = select(func.count(ProjectMembership.id)).where(
        ProjectMembership.project_id == project_id
    )
    return int(db.execute(stmt).scalar() or 0)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(
    payload: CreateProjectRequest,
    teacher: User = Depends(require_verified_teacher),
    db: Session = Depends(get_db),
) -> dict:
    # парсим даты начала и окончания проекта если они переданы
    try:
        start_date = parse_optional_datetime(payload.startDate)
        end_date = parse_optional_datetime(payload.endDate)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    # проверяем логику дат чтобы конец проекта не был раньше старта
    if start_date and end_date and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дата завершения проекта не может быть раньше даты начала.",
        )

    # создаем проект и сразу назначаем преподавателя его единственным руководителем
    project = Project(
        name=payload.name.strip(),
        description=(payload.description or "").strip(),
        creator_id=teacher.id,
        leader_id=teacher.id,
        start_date=start_date,
        end_date=end_date,
        status=ProjectStatus.ACTIVE,
    )
    db.add(project)
    db.flush()

    # добавляем создателя в таблицу участников проекта с ролью leader
    membership = ProjectMembership(
        project_id=project.id,
        user_id=teacher.id,
        role=ProjectRole.LEADER,
    )
    db.add(membership)
    db.commit()

    # подгружаем созданный проект вместе с данными руководителя для ответа
    created = db.execute(
        select(Project)
        .options(joinedload(Project.leader))
        .where(Project.id == project.id)
    ).scalar_one()

    return {
        "project": serialize_project_summary(
            created,
            my_role=ProjectRole.LEADER,
            memberships_count=1,
            tasks_count=0,
        )
    }


@router.get("")
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # достаем только те проекты в которых состоит текущий пользователь
    stmt = (
        select(ProjectMembership)
        .join(Project, ProjectMembership.project_id == Project.id)
        .options(joinedload(ProjectMembership.project).joinedload(Project.leader))
        .where(ProjectMembership.user_id == current_user.id)
        .order_by(Project.updated_at.desc())
    )
    memberships = db.execute(stmt).scalars().all()

    result = []
    for m in memberships:
        proj = m.project
        my_role = (
            ProjectRole.LEADER if proj.leader_id == current_user.id else m.role
        )
        result.append(
            serialize_project_summary(
                proj,
                my_role=my_role,
                memberships_count=_count_members(db, proj.id),
                tasks_count=_count_active_tasks(db, proj.id),
            )
        )

    return {"projects": result}


@router.get("/{project_id}")
def get_project(
    ctx: ProjectAccessContext = Depends(get_project_access),
    db: Session = Depends(get_db),
) -> dict:
    # загружаем полную карточку проекта со списком всех участников
    project = db.execute(
        select(Project)
        .options(
            joinedload(Project.creator),
            joinedload(Project.leader),
            joinedload(Project.memberships).joinedload(ProjectMembership.user),
        )
        .where(Project.id == ctx.project.id)
    ).unique().scalar_one()

    sorted_memberships = sorted(project.memberships, key=lambda m: m.joined_at)
    tasks_count = _count_active_tasks(db, project.id)

    summary = serialize_project_summary(
        project,
        my_role=ctx.role,
        memberships_count=len(sorted_memberships),
        tasks_count=tasks_count,
    )
    summary["creator"] = serialize_user_short(project.creator)
    summary["memberships"] = [serialize_member(m) for m in sorted_memberships]

    return {"project": summary}


@router.patch("/{project_id}")
def update_project(
    payload: UpdateProjectRequest,
    ctx: ProjectAccessContext = Depends(require_project_leader),
    db: Session = Depends(get_db),
) -> dict:
    # редактировать параметры проекта и отправлять его в архив может только руководитель
    project = ctx.project
    fields_set = payload.model_fields_set

    try:
        new_start = (
            parse_optional_datetime(payload.startDate)
            if "startDate" in fields_set
            else project.start_date
        )
        new_end = (
            parse_optional_datetime(payload.endDate)
            if "endDate" in fields_set
            else project.end_date
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    if new_start and new_end and new_end < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дата завершения проекта не может быть раньше даты начала.",
        )

    if "name" in fields_set and payload.name is not None:
        project.name = payload.name.strip()
    if "description" in fields_set and payload.description is not None:
        project.description = payload.description.strip()
    if "startDate" in fields_set:
        project.start_date = new_start
    if "endDate" in fields_set:
        project.end_date = new_end
    if "status" in fields_set and payload.status is not None:
        project.status = payload.status

    db.add(project)
    db.commit()

    updated = db.execute(
        select(Project)
        .options(joinedload(Project.leader))
        .where(Project.id == project.id)
    ).scalar_one()

    return {
        "project": serialize_project_summary(
            updated,
            my_role=ProjectRole.LEADER,
            memberships_count=_count_members(db, updated.id),
            tasks_count=_count_active_tasks(db, updated.id),
        )
    }


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    ctx: ProjectAccessContext = Depends(require_project_leader),
    db: Session = Depends(get_db),
) -> Response:
    # полное удаление проекта руководителем (задачи и участники удалятся каскадно)
    db.delete(ctx.project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/members")
def list_members(
    ctx: ProjectAccessContext = Depends(get_project_access),
    db: Session = Depends(get_db),
) -> dict:
    # отдаем список всех участников проекта по порядку их вступления
    stmt = (
        select(ProjectMembership)
        .options(joinedload(ProjectMembership.user))
        .where(ProjectMembership.project_id == ctx.project.id)
        .order_by(ProjectMembership.joined_at.asc())
    )
    members = db.execute(stmt).scalars().all()
    return {"members": [serialize_member(m) for m in members]}


@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
def add_member(
    payload: AddMemberRequest,
    ctx: ProjectAccessContext = Depends(require_project_leader),
    db: Session = Depends(get_db),
) -> dict:
    # ищем пользователя в системе по введенному email или username
    identifier = payload.identifier.strip()
    target_user = db.execute(
        select(User).where(
            or_(
                User.email == identifier.lower(),
                func.lower(User.username) == identifier.lower(),
            )
        )
    ).scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь с указанным email или логином не найден в системе.",
        )

    if target_user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя добавить заблокированного пользователя.",
        )

    if target_user.account_type == AccountType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Системный администратор не участвует в пользовательских проектах.",
        )

    if target_user.id == ctx.project.leader_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Этот пользователь уже является руководителем проекта.",
        )

    # проверяем не состоит ли человек в этом проекте уже
    existing = db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == ctx.project.id,
            ProjectMembership.user_id == target_user.id,
        )
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Этот пользователь уже состоит в данном проекте.",
        )

    # назначаем выбранную роль (участник или наблюдатель) и сохраняем в базу
    role = (
        ProjectRole.OBSERVER
        if payload.role == "OBSERVER"
        else ProjectRole.MEMBER
    )
    membership = ProjectMembership(
        project_id=ctx.project.id,
        user_id=target_user.id,
        role=role,
    )
    db.add(membership)
    db.commit()

    created = db.execute(
        select(ProjectMembership)
        .options(joinedload(ProjectMembership.user))
        .where(ProjectMembership.id == membership.id)
    ).scalar_one()

    return {"member": serialize_member(created)}


@router.patch("/{project_id}/members/{user_id}")
def update_member_role(
    user_id: UUID,
    payload: UpdateMemberRoleRequest,
    ctx: ProjectAccessContext = Depends(require_project_leader),
    db: Session = Depends(get_db),
) -> dict:
    # запрещаем менять роль самого руководителя проекта
    if user_id == ctx.project.leader_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нельзя изменить роль руководителя проекта.",
        )

    membership = db.execute(
        select(ProjectMembership)
        .options(joinedload(ProjectMembership.user))
        .where(
            ProjectMembership.project_id == ctx.project.id,
            ProjectMembership.user_id == user_id,
        )
    ).scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Участник не найден в этом проекте.",
        )

    # переключаем роль между участником и наблюдателем
    membership.role = (
        ProjectRole.OBSERVER
        if payload.role == "OBSERVER"
        else ProjectRole.MEMBER
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)

    return {"member": serialize_member(membership)}


@router.delete(
    "/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_member(
    user_id: UUID,
    ctx: ProjectAccessContext = Depends(require_project_leader),
    db: Session = Depends(get_db),
) -> Response:
    # руководитель не может удалить сам себя из проекта
    if user_id == ctx.project.leader_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нельзя удалить руководителя из собственного проекта.",
        )

    membership = db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == ctx.project.id,
            ProjectMembership.user_id == user_id,
        )
    ).scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Участник не найден в этом проекте.",
        )

    db.delete(membership)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
