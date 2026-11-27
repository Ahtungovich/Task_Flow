# !! Добавлен новый модуль роутера для внутренних уведомлений пользователя на сайте (Этап 12)
# Поддерживает:
# - Автоматическую генерацию напоминаний за 3 дня и за 1 день до дедлайна по назначенным задачам
# - Получение списка уведомлений и счётчика непрочитанных
# - Отметку одного или всех уведомлений как прочитанных, а также удаление прочитанных
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Notification, Project, Task, TaskStatus, User, utc_now
from app.schemas import serialize_notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def sync_deadline_reminders_for_user(db: Session, user_id: UUID) -> None:
    # Проверяем все активные задачи, назначенные пользователю, у которых задан дедлайн.
    # Если до дедлайна осталось <= 3 дней (и > 1 дня) — создаём напоминание за 3 дня (DEADLINE_3D).
    # Если до дедлайна осталось <= 1 дня (и срок ещё не прошёл более чем на сутки) — создаём напоминание за 1 день (DEADLINE_1D).
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_date = now.date()

    tasks = (
        db.execute(
            select(Task)
            .options(joinedload(Task.project))
            .where(
                Task.assignee_id == user_id,
                Task.deleted_at.is_(None),
                Task.status != TaskStatus.DONE,
                Task.deadline.is_not(None),
            )
        )
        .scalars()
        .all()
    )

    if not tasks:
        return

    candidate_keys: list[str] = []
    candidates: list[tuple[str, Task, str, str, str]] = []

    for task in tasks:
        if task.deadline is None:
            continue
        deadline_date = task.deadline.date()
        days_left = (deadline_date - today_date).days
        deadline_str = task.deadline.strftime("%d.%m.%Y")
        project_name = task.project.name if task.project else "Проект"

        # Напоминание за 3 дня до окончания дедлайна (когда осталось 2 или 3 дня)
        if 2 <= days_left <= 3:
            dedup_key = f"deadline_3d:{task.id}:{deadline_date.isoformat()}"
            candidate_keys.append(dedup_key)
            candidates.append(
                (
                    dedup_key,
                    task,
                    "DEADLINE_3D",
                    "До дедлайна осталось 3 дня",
                    f"По задаче «{task.title}» в проекте «{project_name}» приближается срок сдачи ({deadline_str}).",
                )
            )
        # Напоминание за 1 день до окончания дедлайна (когда осталось 0 или 1 день)
        elif 0 <= days_left <= 1:
            dedup_key = f"deadline_1d:{task.id}:{deadline_date.isoformat()}"
            day_word = "сегодня" if days_left == 0 else "через 1 день"
            candidate_keys.append(dedup_key)
            candidates.append(
                (
                    dedup_key,
                    task,
                    "DEADLINE_1D",
                    "Срочно: дедлайн через 1 день" if days_left == 1 else "Срочно: дедлайн сегодня",
                    f"Срок сдачи задачи «{task.title}» в проекте «{project_name}» истекает {day_word} ({deadline_str}).",
                )
            )

    if not candidates:
        return

    # Находим ключи уведомлений, которые уже были созданы ранее, чтобы не дублировать их
    existing_keys = set(
        db.execute(
            select(Notification.dedup_key).where(
                Notification.dedup_key.in_(candidate_keys)
            )
        )
        .scalars()
        .all()
    )

    created_any = False
    for dedup_key, task, kind, title, message in candidates:
        if dedup_key in existing_keys:
            continue
        db.add(
            Notification(
                user_id=user_id,
                project_id=task.project_id,
                task_id=task.id,
                kind=kind,
                title=title,
                message=message,
                dedup_key=dedup_key,
                is_read=False,
                created_at=utc_now(),
            )
        )
        existing_keys.add(dedup_key)
        created_any = True

    if created_any:
        db.commit()


@router.get("")
def list_my_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # Перед выдачей списка проверяем актуальные дедлайны задач пользователя
    sync_deadline_reminders_for_user(db, current_user.id)

    items = (
        db.execute(
            select(Notification)
            .options(joinedload(Notification.project))
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )

    unread_count = sum(1 for n in items if not n.is_read)

    return {
        "notifications": [serialize_notification(n) for n in items],
        "unreadCount": unread_count,
    }


@router.get("/unread-count")
def get_unread_notifications_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # Актуализируем напоминания по дедлайнам и возвращаем число непрочитанных уведомлений для красного бейджа
    sync_deadline_reminders_for_user(db, current_user.id)

    unread_count = (
        db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
            )
        ).scalar()
        or 0
    )

    return {"unreadCount": unread_count}


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # Отмечаем конкретное уведомление прочитанным
    notif = db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Уведомление не найдено.",
        )

    if not notif.is_read:
        notif.is_read = True
        db.add(notif)
        db.commit()

    return {"success": True}


@router.post("/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # Отмечаем все непрочитанные уведомления пользователя прочитанными
    db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    db.commit()
    return {"success": True}
