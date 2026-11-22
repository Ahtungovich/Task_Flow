# TaskFlow Backend (Python + FastAPI + SQLAlchemy)

Серверная часть системы совместного планирования учебных проектов TaskFlow, реализованная на **Python** с использованием фреймворка **FastAPI** и **SQLAlchemy**.

## Структура папки `app/`
- `main.py` — точка входа FastAPI, настройка CORS, единый обработчик ошибок и подключение роутеров `/api/v1`.
- `config.py` — чтение параметров из файла `.env` (`DATABASE_URL`, `SESSION_SECRET`, `PORT` и др.).
- `database.py` — настройка подключения SQLAlchemy к PostgreSQL.
- `models.py` — описание таблиц БД (`User`, `UserSession`, `Project`, `ProjectMembership`, `Task`, `Label`, `TaskLabel`, `Comment`).
- `schemas.py` — Pydantic-модели для проверки входящих данных и сериализации ответов в JSON.
- `security.py` — хеширование паролей алгоритмом **Argon2id** и работа с сессиями (`SHA-256` + `HttpOnly` cookie `taskflow_sid`).
- `dependencies.py` — проверки доступа (`get_current_user`, `require_verified_teacher`, `get_project_access`, `require_project_leader`).
- `routers/` — эндпоинты REST API (`health.py`, `auth.py`, `users.py`, `projects.py`, `tasks.py`).

## Документация API (Swagger)
При запущенном сервере интерактивная документация всех методов доступна по адресу:
`http://localhost:3000/api/v1/docs`
