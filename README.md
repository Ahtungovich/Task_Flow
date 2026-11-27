# TaskFlow

Система управления учебными проектами, командами и задачами.

## Стек технологий

* **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL (Docker)
* **Frontend:** React, TypeScript, Vite, Tailwind CSS, TanStack Query

## Что реализовано на Этапе 12
- Модель `Notification` (`notifications`), автоматическая генерация уведомлений при назначении новой задачи (`activity_hooks.py`) и роутер `notifications.py` (`GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/{notification_id}/read`, `POST /api/v1/notifications/read-all`) на Python (FastAPI + SQLAlchemy) с дедуплицированными напоминаниями за 3 дня и за 1 день до дедлайна
- Компонент `NotificationsBellButton` (`notificationsApi.ts`) в шапке личного кабинета (`DashboardPage`) вместо кнопки «Профиль» с красным кружочком-счётчиком непрочитанных уведомлений (скрывается при нуле), выпадающей лентой оповещений и переходом в карточку задачи
