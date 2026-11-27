import re
from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

# !! Добавлен импорт модели Notification для сериализации уведомлений пользователя (Этап 12)
from app.models import (
    ActivityLog,
    Attachment,
    Comment,
    Label,
    Notification,
    Project,
    ProjectMembership,
    ProjectRole,
    ProjectStatus,
    Task,
    TaskPriority,
    TaskStatus,
    User,
)

# регулярка для проверки логина разрешаем только латиницу цифры и пару символов
USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_.-]+$")
# регулярка для проверки цвета метки в hex формате например #2563eb
HEX_COLOR_REGEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def to_iso(dt: Optional[datetime]) -> Optional[str]:
    # переводим объект даты в строку формата iso с буквой z на конце для фронтенда
    if dt is None:
        return None
    return dt.isoformat() + "Z"


def parse_optional_datetime(value: Optional[str]) -> Optional[datetime]:
    # аккуратно парсим дату из строки вида yyyy-mm-dd или полной iso-строки
    if value is None:
        return None
    text = value.strip()
    if text == "":
        return None
    try:
        if len(text) == 10:
            return datetime.strptime(text, "%Y-%m-%d")
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    except ValueError as exc:
        raise ValueError("Некорректный формат даты.") from exc


# ==========================================
# схемы входящих запросов (валидация от пользователя)
# ==========================================


# данные для регистрации нового аккаунта
class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=32)
    fullName: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    accountType: Literal["STUDENT", "TEACHER"]

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        trimmed = v.strip()
        if not USERNAME_REGEX.match(trimmed):
            raise ValueError(
                "Имя пользователя может содержать только латинские буквы, цифры, точки, дефисы и подчёркивания."
            )
        return trimmed


# данные для входа в систему (можно ввести либо email либо логин)
class LoginRequest(BaseModel):
    login: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


# данные для обновления профиля пользователя
class UpdateProfileRequest(BaseModel):
    fullName: Optional[str] = Field(default=None, min_length=2, max_length=120)
    username: Optional[str] = Field(default=None, min_length=3, max_length=32)
    avatar: Optional[str] = Field(default=None, max_length=500)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        if not USERNAME_REGEX.match(trimmed):
            raise ValueError(
                "Имя пользователя может содержать только латинские буквы, цифры, точки, дефисы и подчёркивания."
            )
        return trimmed

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return None
        trimmed = v.strip()
        if not (trimmed.startswith("http://") or trimmed.startswith("https://")):
            raise ValueError(
                "Ссылка на аватар должна начинаться с http:// или https://."
            )
        return trimmed


# данные для смены пароля
class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(min_length=1, max_length=128)
    newPassword: str = Field(min_length=8, max_length=128)


# данные для создания нового проекта
class CreateProjectRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = Field(default="", max_length=2000)
    startDate: Optional[str] = None
    endDate: Optional[str] = None


# данные для редактирования настроек или архивации проекта
class UpdateProjectRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=2000)
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    status: Optional[ProjectStatus] = None


# данные для приглашения участника в проект (назначать можно только участника или наблюдателя)
class AddMemberRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255)
    role: Literal["MEMBER", "OBSERVER"]


# данные для смены роли участника внутри проекта
class UpdateMemberRoleRequest(BaseModel):
    role: Literal["MEMBER", "OBSERVER"]


# данные для создания новой задачи
class CreateTaskRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: Optional[str] = Field(default="", max_length=5000)
    assigneeId: Optional[UUID] = None
    priority: Optional[TaskPriority] = TaskPriority.MEDIUM
    status: Optional[TaskStatus] = TaskStatus.NEW
    startDate: Optional[str] = None
    deadline: Optional[str] = None
    labelIds: Optional[list[UUID]] = None


# данные для редактирования существующей задачи
class UpdateTaskRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    assigneeId: Optional[UUID] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    position: Optional[int] = Field(default=None, ge=0)
    startDate: Optional[str] = None
    deadline: Optional[str] = None
    labelIds: Optional[list[UUID]] = None


# данные для быстрого переноса карточки задачи в другую колонку
class UpdateTaskStatusRequest(BaseModel):
    status: TaskStatus
    position: Optional[int] = Field(default=None, ge=0)


# данные для создания цветной метки в проекте
class CreateLabelRequest(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: Optional[str] = "#475569"

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> str:
        if v is None:
            return "#475569"
        if not HEX_COLOR_REGEX.match(v.strip()):
            raise ValueError(
                "Цвет метки должен быть в HEX-формате, например #2563eb."
            )
        return v.strip()


# данные для отправки нового комментария к задаче
class CreateCommentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Текст комментария не может быть пустым.")
        return trimmed


# данные для подтверждения или отзыва статуса преподавателя администратором
class VerifyTeacherRequest(BaseModel):
    verified: bool


# ==========================================
# функции сборки json-ответов для фронтенда
# ==========================================


def serialize_user(user: User) -> dict:
    # собираем полный профиль пользователя без секретного хеша пароля
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "fullName": user.full_name,
        "avatar": user.avatar,
        "accountType": user.account_type.value,
        "isTeacherVerified": user.is_teacher_verified,
        "emailVerified": user.email_verified,
        "isBlocked": user.is_blocked,
        "createdAt": to_iso(user.created_at),
        "updatedAt": to_iso(user.updated_at),
    }


def serialize_teacher_application(user: User, projects_count: int = 0) -> dict:
    # собираем карточку преподавателя для панели администратора
    data = serialize_user(user)
    data["projectsCount"] = projects_count
    return data


def serialize_user_short(user: User) -> dict:
    # сокращенная карточка пользователя для списков участников и исполнителей задач
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "fullName": user.full_name,
        "avatar": user.avatar,
        "accountType": user.account_type.value,
    }


def serialize_member(membership: ProjectMembership) -> dict:
    # формируем json с информацией об участнике проекта и его роли
    return {
        "id": str(membership.id),
        "projectId": str(membership.project_id),
        "userId": str(membership.user_id),
        "role": membership.role.value,
        "joinedAt": to_iso(membership.joined_at),
        "user": serialize_user_short(membership.user),
    }


def serialize_project_summary(
    project: Project,
    my_role: ProjectRole,
    memberships_count: int,
    tasks_count: int,
) -> dict:
    # собираем карточку проекта со счетчиками участников и активных задач
    return {
        "id": str(project.id),
        "name": project.name,
        "description": project.description,
        "creatorId": str(project.creator_id),
        "leaderId": str(project.leader_id),
        "startDate": to_iso(project.start_date),
        "endDate": to_iso(project.end_date),
        "status": project.status.value,
        "createdAt": to_iso(project.created_at),
        "updatedAt": to_iso(project.updated_at),
        "myRole": my_role.value,
        "leader": serialize_user_short(project.leader),
        "_count": {
            "memberships": memberships_count,
            "tasks": tasks_count,
        },
    }


def serialize_label(label: Label) -> dict:
    # собираем словарь с данными цветного тега
    return {
        "id": str(label.id),
        "projectId": str(label.project_id),
        "name": label.name,
        "color": label.color,
        "createdAt": to_iso(label.created_at),
    }


def serialize_task(task: Task) -> dict:
    # автоматически вычисляем просрочена ли задача (если дедлайн прошел а статус не готово)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    is_overdue = bool(
        task.deadline is not None
        and task.status != TaskStatus.DONE
        and task.deadline < now
    )
    # считаем только неудаленные комментарии
    active_comments = [c for c in task.comments if c.deleted_at is None]

    return {
        "id": str(task.id),
        "projectId": str(task.project_id),
        "authorId": str(task.author_id),
        "assigneeId": str(task.assignee_id) if task.assignee_id else None,
        "title": task.title,
        "description": task.description,
        "status": task.status.value,
        "priority": task.priority.value,
        "position": task.position,
        "startDate": to_iso(task.start_date),
        "deadline": to_iso(task.deadline),
        "isOverdue": is_overdue,
        "createdAt": to_iso(task.created_at),
        "updatedAt": to_iso(task.updated_at),
        "author": serialize_user_short(task.author),
        "assignee": serialize_user_short(task.assignee) if task.assignee else None,
        "labels": [serialize_label(tl.label) for tl in task.task_labels],
        "commentsCount": len(active_comments),
    }


def serialize_comment(comment: Comment) -> dict:
    # собираем словарь с данными комментария и его автора для ленты обсуждения
    return {
        "id": str(comment.id),
        "taskId": str(comment.task_id),
        "authorId": str(comment.author_id),
        "text": comment.text,
        "createdAt": to_iso(comment.created_at),
        "updatedAt": to_iso(comment.updated_at),
        "author": serialize_user_short(comment.author),
    }


def serialize_my_task(task: Task) -> dict:
    # расширяем карточку задачи названием и статусом проекта для сводки в личном кабинете
    data = serialize_task(task)
    data["project"] = {
        "id": str(task.project.id),
        "name": task.project.name,
        "status": task.project.status.value,
    }
    return data


def serialize_attachment(attachment: Attachment) -> dict:
    return {
        "id": str(attachment.id),
        "projectId": str(attachment.project_id),
        "taskId": str(attachment.task_id) if attachment.task_id else None,
        "uploaderId": str(attachment.uploader_id),
        "originalName": attachment.original_name,
        "contentType": attachment.content_type,
        "sizeBytes": attachment.size_bytes,
        "createdAt": to_iso(attachment.created_at),
        "uploader": serialize_user_short(attachment.uploader),
        "downloadUrl": f"/api/v1/attachments/{attachment.id}/download",
    }


def serialize_activity_log(log: ActivityLog) -> dict:
    return {
        "id": str(log.id),
        "projectId": str(log.project_id),
        "actorId": str(log.actor_id) if log.actor_id else None,
        "taskId": str(log.task_id) if log.task_id else None,
        "entityType": log.entity_type,
        "action": log.action,
        "summary": log.summary,
        "details": log.details,
        "createdAt": to_iso(log.created_at),
        "actor": serialize_user_short(log.actor) if log.actor else None,
    }


# !! Добавлен сериализатор для внутренних уведомлений пользователя (Этап 12)
def serialize_notification(item: Notification) -> dict:
    return {
        "id": str(item.id),
        "userId": str(item.user_id),
        "projectId": str(item.project_id) if item.project_id else None,
        "taskId": str(item.task_id) if item.task_id else None,
        "kind": item.kind,
        "title": item.title,
        "message": item.message,
        "isRead": item.is_read,
        "createdAt": to_iso(item.created_at),
        "projectName": item.project.name if item.project else None,
    }
