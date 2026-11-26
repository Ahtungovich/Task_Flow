# TaskFlow

Система управления учебными проектами, командами и задачами.

## Стек технологий

* **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL (Docker)
* **Frontend:** React, TypeScript, Vite, Tailwind CSS, TanStack Query

## Что реализовано на Этапе 10
- Модель `Attachment` и роутер вложений (`attachments.py`) на Python (FastAPI + SQLAlchemy + `python-multipart`) с эндпоинтами загрузки, списка, скачивания и удаления файлов до 20 МБ на уровне проекта (`/api/v1/projects/{project_id}/attachments`) и конкретной задачи (`/api/v1/projects/{project_id}/tasks/{task_id}/attachments`)
- Универсальный компонент `AttachmentsSection` (`attachmentsApi.ts`) на вкладке «Доска задач» (`ProjectDetailsPage`) с отображением размера, автора, скачиванием с исходным именем и разграничением прав (наблюдатель может только скачивать, удалять могут автор файла или руководитель)
- План 75% MVP (Этапы 1–10) выполнен на стеке **React + Vite / Python + FastAPI + SQLAlchemy / PostgreSQL + Docker**