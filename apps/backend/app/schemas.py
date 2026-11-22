import re
from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import (
    Label,
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
