# !! Добавлен модуль автоматического аудита изменений проекта через SQLAlchemy ORM (Этап 11)
# Отслеживает создание, редактирование и удаление задач, смену статусов, приоритетов,
# дедлайнов, исполнителей, участников, ролей, комментариев, меток и файлов в рамках транзакции БД.
from contextvars import ContextVar
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import event, inspect, select
from sqlalchemy.orm import Session

from app.models import (
    ActivityLog,
    Attachment,
    Comment,
    Label,
    Project,
    ProjectMembership,
    ProjectRole,
    ProjectStatus,
    Task,
    TaskLabel,
    TaskPriority,
    TaskStatus,
    User,
    utc_now,
)

# !! Контекстная переменная для хранения ID текущего пользователя, выполняющего HTTP-запрос
current_actor_id_var: ContextVar[Optional[UUID]] = ContextVar(
    "current_actor_id_var", default=None
)

# !! Словари человекочитаемых переводов статусов, приоритетов и ролей для красивых записей в логах
TASK_STATUS_RU = {
    TaskStatus.NEW: "Новая",
    TaskStatus.IN_PROGRESS: "В работе",
    TaskStatus.IN_REVIEW: "На проверке",
    TaskStatus.DONE: "Готово",
    TaskStatus.BLOCKED: "Заблокировано",
    TaskStatus.POSTPONED: "Отложено",
}

TASK_PRIORITY_RU = {
    TaskPriority.LOW: "Низкий",
    TaskPriority.MEDIUM: "Средний",
    TaskPriority.HIGH: "Высокий",
    TaskPriority.CRITICAL: "Критический",
}

PROJECT_ROLE_RU = {
    ProjectRole.LEADER: "Руководитель",
    ProjectRole.MEMBER: "Участник",
    ProjectRole.OBSERVER: "Наблюдатель",
}

PROJECT_STATUS_RU = {
    ProjectStatus.ACTIVE: "Активный",
    ProjectStatus.ARCHIVED: "В архиве",
}


def _fmt_date(dt: Optional[datetime]) -> str:
    if dt is None:
        return "не задан"
    return dt.strftime("%d.%m.%Y")


def _resolve_user_name(session: Session, user_id: Optional[UUID]) -> str:
    if not user_id:
        return "Не назначен"
    user = session.get(User, user_id)
    if user:
        return user.full_name
    return "Пользователь"


def _resolve_task_title(session: Session, task_id: Optional[UUID]) -> str:
    if not task_id:
        return "Задача"
    task = session.get(Task, task_id)
    if task:
        return task.title
    return "Задача"


def _get_actor_id(fallback_id: Optional[UUID] = None) -> Optional[UUID]:
    actor = current_actor_id_var.get()
    return actor if actor is not None else fallback_id


def _build_log(
    project_id: UUID,
    actor_id: Optional[UUID],
    entity_type: str,
    action: str,
    summary: str,
    details: Optional[str] = None,
    task_id: Optional[UUID] = None,
) -> ActivityLog:
    return ActivityLog(
        project_id=project_id,
        actor_id=actor_id,
        task_id=task_id,
        entity_type=entity_type,
        action=action,
        summary=summary,
        details=details,
        created_at=utc_now(),
    )


def _before_flush_audit(session: Session, flush_context, instances) -> None:
    # Избегаем повторного срабатывания внутри одного flush
    if session.info.get("_audit_in_progress"):
        return

    logs_to_add: list[ActivityLog] = []

    # 1. Новые объекты (session.new)
    for obj in list(session.new):
        if isinstance(obj, Project):
            actor_id = _get_actor_id(obj.creator_id)
            logs_to_add.append(
                _build_log(
                    project_id=obj.id,
                    actor_id=actor_id,
                    entity_type="PROJECT",
                    action="CREATED",
                    summary=f"Создал проект «{obj.name}»",
                )
            )

        elif isinstance(obj, ProjectMembership):
            # Не дублируем лог добавления руководителя в момент самого создания проекта
            project_is_new = any(
                isinstance(n, Project) and n.id == obj.project_id for n in session.new
            )
            if not project_is_new:
                member_name = _resolve_user_name(session, obj.user_id)
                role_label = PROJECT_ROLE_RU.get(obj.role, str(obj.role))
                logs_to_add.append(
                    _build_log(
                        project_id=obj.project_id,
                        actor_id=_get_actor_id(),
                        entity_type="MEMBER",
                        action="ADDED",
                        summary=f"Добавил участника {member_name} в команду",
                        details=f"Роль в проекте: {role_label}",
                    )
                )

        elif isinstance(obj, Task):
            actor_id = _get_actor_id(obj.author_id)
            details_parts = [
                f"Статус: {TASK_STATUS_RU.get(obj.status, str(obj.status))}",
                f"Приоритет: {TASK_PRIORITY_RU.get(obj.priority, str(obj.priority))}",
            ]
            if obj.assignee_id:
                details_parts.append(
                    f"Исполнитель: {_resolve_user_name(session, obj.assignee_id)}"
                )
            if obj.deadline:
                details_parts.append(f"Дедлайн: {_fmt_date(obj.deadline)}")

            logs_to_add.append(
                _build_log(
                    project_id=obj.project_id,
                    actor_id=actor_id,
                    task_id=obj.id,
                    entity_type="TASK",
                    action="CREATED",
                    summary=f"Создал задачу «{obj.title}»",
                    details=" · ".join(details_parts),
                )
            )

        elif isinstance(obj, Comment):
            task = obj.task or session.get(Task, obj.task_id)
            if task:
                actor_id = _get_actor_id(obj.author_id)
                preview = obj.text.strip()
                if len(preview) > 90:
                    preview = preview[:87] + "..."
                logs_to_add.append(
                    _build_log(
                        project_id=task.project_id,
                        actor_id=actor_id,
                        task_id=task.id,
                        entity_type="COMMENT",
                        action="CREATED",
                        summary=f"Оставил комментарий к задаче «{task.title}»",
                        details=f"«{preview}»",
                    )
                )

        elif isinstance(obj, Attachment):
            actor_id = _get_actor_id(obj.uploader_id)
            if obj.task_id:
                task_title = _resolve_task_title(session, obj.task_id)
                logs_to_add.append(
                    _build_log(
                        project_id=obj.project_id,
                        actor_id=actor_id,
                        task_id=obj.task_id,
                        entity_type="ATTACHMENT",
                        action="UPLOADED",
                        summary=f"Прикрепил файл «{obj.original_name}» к задаче «{task_title}»",
                    )
                )
            else:
                logs_to_add.append(
                    _build_log(
                        project_id=obj.project_id,
                        actor_id=actor_id,
                        entity_type="ATTACHMENT",
                        action="UPLOADED",
                        summary=f"Загрузил файл «{obj.original_name}» в материалы проекта",
                    )
                )

        elif isinstance(obj, Label):
            logs_to_add.append(
                _build_log(
                    project_id=obj.project_id,
                    actor_id=_get_actor_id(),
                    entity_type="LABEL",
                    action="CREATED",
                    summary=f"Создал метку проекта «{obj.name}»",
                    details=f"Цвет: {obj.color}",
                )
            )

    # 2. Изменённые объекты (session.dirty)
    for obj in list(session.dirty):
        if not session.is_modified(obj, include_collections=False):
            continue

        state = inspect(obj)

        if isinstance(obj, Task):
            actor_id = _get_actor_id(obj.author_id)
            # Проверяем мягкое удаление задачи
            del_hist = state.attrs.deleted_at.history
            if del_hist.has_changes() and obj.deleted_at is not None:
                logs_to_add.append(
                    _build_log(
                        project_id=obj.project_id,
                        actor_id=actor_id,
                        task_id=obj.id,
                        entity_type="TASK",
                        action="DELETED",
                        summary=f"Удалил задачу «{obj.title}»",
                    )
                )
                continue

            # Проверяем смену статуса (в том числе Drag-and-Drop по колонкам канбана)
            status_hist = state.attrs.status.history
            if status_hist.has_changes() and status_hist.deleted:
                old_st = status_hist.deleted[0]
                new_st = obj.status
                if old_st != new_st:
                    logs_to_add.append(
                        _build_log(
                            project_id=obj.project_id,
                            actor_id=actor_id,
                            task_id=obj.id,
                            entity_type="TASK",
                            action="STATUS_CHANGED",
                            summary=f"Переместил задачу «{obj.title}»",
                            details=f"{TASK_STATUS_RU.get(old_st, str(old_st))} → {TASK_STATUS_RU.get(new_st, str(new_st))}",
                        )
                    )

            # Проверяем смену исполнителя
            assignee_hist = state.attrs.assignee_id.history
            if assignee_hist.has_changes():
                old_uid = assignee_hist.deleted[0] if assignee_hist.deleted else None
                new_uid = obj.assignee_id
                if old_uid != new_uid:
                    old_name = _resolve_user_name(session, old_uid)
                    new_name = _resolve_user_name(session, new_uid)
                    logs_to_add.append(
                        _build_log(
                            project_id=obj.project_id,
                            actor_id=actor_id,
                            task_id=obj.id,
                            entity_type="TASK",
                            action="ASSIGNED",
                            summary=f"Изменил исполнителя задачи «{obj.title}»",
                            details=f"{old_name} → {new_name}",
                        )
                    )

            # Проверяем смену приоритета
            prio_hist = state.attrs.priority.history
            if prio_hist.has_changes() and prio_hist.deleted:
                old_pr = prio_hist.deleted[0]
                new_pr = obj.priority
                if old_pr != new_pr:
                    logs_to_add.append(
                        _build_log(
                            project_id=obj.project_id,
                            actor_id=actor_id,
                            task_id=obj.id,
                            entity_type="TASK",
                            action="UPDATED",
                            summary=f"Изменил приоритет задачи «{obj.title}»",
                            details=f"{TASK_PRIORITY_RU.get(old_pr, str(old_pr))} → {TASK_PRIORITY_RU.get(new_pr, str(new_pr))}",
                        )
                    )

            # Проверяем смену дедлайна
            deadline_hist = state.attrs.deadline.history
            if deadline_hist.has_changes():
                old_dl = deadline_hist.deleted[0] if deadline_hist.deleted else None
                new_dl = obj.deadline
                if old_dl != new_dl:
                    logs_to_add.append(
                        _build_log(
                            project_id=obj.project_id,
                            actor_id=actor_id,
                            task_id=obj.id,
                            entity_type="TASK",
                            action="UPDATED",
                            summary=f"Обновил дедлайн задачи «{obj.title}»",
                            details=f"{_fmt_date(old_dl)} → {_fmt_date(new_dl)}",
                        )
                    )

            # Проверяем переименование задачи
            title_hist = state.attrs.title.history
            if title_hist.has_changes() and title_hist.deleted:
                old_title = title_hist.deleted[0]
                if old_title != obj.title:
                    logs_to_add.append(
                        _build_log(
                            project_id=obj.project_id,
                            actor_id=actor_id,
                            task_id=obj.id,
                            entity_type="TASK",
                            action="UPDATED",
                            summary=f"Переименовал задачу",
                            details=f"«{old_title}» → «{obj.title}»",
                        )
                    )

            # Проверяем изменение описания задачи (если других более специфичных правок не было)
            desc_hist = state.attrs.description.history
            if (
                desc_hist.has_changes()
                and not status_hist.has_changes()
                and not assignee_hist.has_changes()
                and not prio_hist.has_changes()
                and not deadline_hist.has_changes()
                and not title_hist.has_changes()
            ):
                logs_to_add.append(
                    _build_log(
                        project_id=obj.project_id,
                        actor_id=actor_id,
                        task_id=obj.id,
                        entity_type="TASK",
                        action="UPDATED",
                        summary=f"Обновил описание задачи «{obj.title}»",
                    )
                )

        elif isinstance(obj, Project):
            actor_id = _get_actor_id(obj.leader_id)

            status_hist = state.attrs.status.history
            if status_hist.has_changes() and status_hist.deleted:
                old_st = status_hist.deleted[0]
                if old_st != obj.status:
                    logs_to_add.append(
                        _build_log(
                            project_id=obj.id,
                            actor_id=actor_id,
                            entity_type="PROJECT",
                            action="STATUS_CHANGED",
                            summary="Изменил статус проекта",
                            details=f"{PROJECT_STATUS_RU.get(old_st, str(old_st))} → {PROJECT_STATUS_RU.get(obj.status, str(obj.status))}",
                        )
                    )

            leader_hist = state.attrs.leader_id.history
            if leader_hist.has_changes() and leader_hist.deleted:
                old_lid = leader_hist.deleted[0]
                if old_lid != obj.leader_id:
                    new_leader_name = _resolve_user_name(session, obj.leader_id)
                    logs_to_add.append(
                        _build_log(
                            project_id=obj.id,
                            actor_id=actor_id,
                            entity_type="PROJECT",
                            action="LEADER_CHANGED",
                            summary=f"Передал руководство проектом пользователю {new_leader_name}",
                        )
                    )

            name_hist = state.attrs.name.history
            if name_hist.has_changes() and name_hist.deleted:
                old_name = name_hist.deleted[0]
                if old_name != obj.name:
                    logs_to_add.append(
                        _build_log(
                            project_id=obj.id,
                            actor_id=actor_id,
                            entity_type="PROJECT",
                            action="UPDATED",
                            summary="Изменил название проекта",
                            details=f"«{old_name}» → «{obj.name}»",
                        )
                    )

        elif isinstance(obj, ProjectMembership):
            role_hist = state.attrs.role.history
            if role_hist.has_changes() and role_hist.deleted:
                old_r = role_hist.deleted[0]
                if old_r != obj.role:
                    member_name = _resolve_user_name(session, obj.user_id)
                    logs_to_add.append(
                        _build_log(
                            project_id=obj.project_id,
                            actor_id=_get_actor_id(),
                            entity_type="MEMBER",
                            action="ROLE_CHANGED",
                            summary=f"Изменил роль участника {member_name}",
                            details=f"{PROJECT_ROLE_RU.get(old_r, str(old_r))} → {PROJECT_ROLE_RU.get(obj.role, str(obj.role))}",
                        )
                    )

        elif isinstance(obj, Comment):
            task = obj.task or session.get(Task, obj.task_id)
            if task:
                actor_id = _get_actor_id(obj.author_id)
                del_hist = state.attrs.deleted_at.history
                if del_hist.has_changes() and obj.deleted_at is not None:
                    logs_to_add.append(
                        _build_log(
                            project_id=task.project_id,
                            actor_id=actor_id,
                            task_id=task.id,
                            entity_type="COMMENT",
                            action="DELETED",
                            summary=f"Удалил комментарий в задаче «{task.title}»",
                        )
                    )
                elif state.attrs.text.history.has_changes():
                    logs_to_add.append(
                        _build_log(
                            project_id=task.project_id,
                            actor_id=actor_id,
                            task_id=task.id,
                            entity_type="COMMENT",
                            action="UPDATED",
                            summary=f"Отредактировал комментарий в задаче «{task.title}»",
                        )
                    )

        elif isinstance(obj, Attachment):
            del_hist = state.attrs.deleted_at.history
            if del_hist.has_changes() and obj.deleted_at is not None:
                actor_id = _get_actor_id(obj.uploader_id)
                if obj.task_id:
                    task_title = _resolve_task_title(session, obj.task_id)
                    logs_to_add.append(
                        _build_log(
                            project_id=obj.project_id,
                            actor_id=actor_id,
                            task_id=obj.task_id,
                            entity_type="ATTACHMENT",
                            action="DELETED",
                            summary=f"Удалил файл «{obj.original_name}» из задачи «{task_title}»",
                        )
                    )
                else:
                    logs_to_add.append(
                        _build_log(
                            project_id=obj.project_id,
                            actor_id=actor_id,
                            entity_type="ATTACHMENT",
                            action="DELETED",
                            summary=f"Удалил файл «{obj.original_name}» из материалов проекта",
                        )
                    )

    # 3. Удалённые объекты (session.deleted)
    for obj in list(session.deleted):
        if isinstance(obj, ProjectMembership):
            project_is_deleted = any(
                isinstance(d, Project) and d.id == obj.project_id
                for d in session.deleted
            )
            if not project_is_deleted:
                member_name = _resolve_user_name(session, obj.user_id)
                logs_to_add.append(
                    _build_log(
                        project_id=obj.project_id,
                        actor_id=_get_actor_id(),
                        entity_type="MEMBER",
                        action="REMOVED",
                        summary=f"Удалил участника {member_name} из проекта",
                    )
                )

        elif isinstance(obj, Label):
            project_is_deleted = any(
                isinstance(d, Project) and d.id == obj.project_id
                for d in session.deleted
            )
            if not project_is_deleted:
                logs_to_add.append(
                    _build_log(
                        project_id=obj.project_id,
                        actor_id=_get_actor_id(),
                        entity_type="LABEL",
                        action="DELETED",
                        summary=f"Удалил метку проекта «{obj.name}»",
                    )
                )

    if logs_to_add:
        session.info["_audit_in_progress"] = True
        try:
            for item in logs_to_add:
                session.add(item)
        finally:
            session.info["_audit_in_progress"] = False


def register_activity_hooks() -> None:
    # Регистрируем обработчик один раз на уровне класса Session
    if not event.contains(Session, "before_flush", _before_flush_audit):
        event.listen(Session, "before_flush", _before_flush_audit)
