# TaskFlow

Система управления учебными проектами, командами и задачами.

## Стек технологий

* **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL (Docker)
* **Frontend:** React, TypeScript, Vite, Tailwind CSS, TanStack Query

## Что реализовано на Этапе 11
- Модель `ActivityLog` (`activity_logs`), модуль автоматического аудита SQLAlchemy (`activity_hooks.py`) с определением автора действия из сессии и эндпоинт `GET /api/v1/projects/{project_id}/activity` (`activity.py`) на Python (FastAPI + SQLAlchemy), фиксирующий изменения задач, статусов, исполнителей, дедлайнов, участников, комментариев, меток и файлов проекта
- Кнопка **«История изменений»** на панели доски проекта рядом с переключателем «Канбан-доска / Список» и кнопкой «Метки проекта» (`ProjectTasksBoard`), открывающая модальное окно `ProjectActivityModal` (`activityApi.ts`) с фильтрацией событий по категориям и поиском по участникам и задачам
- План 85% MVP (Этапы 1–11) выполнен на стеке **React + Vite / Python + FastAPI + SQLAlchemy / PostgreSQL + Docker**