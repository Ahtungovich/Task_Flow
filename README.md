# TaskFlow — Этап 6 (Комментарии к задачам)

## Что реализовано на Этапе 6
- REST API комментариев к задачам на Python (FastAPI + SQLAlchemy):
  - `GET /api/v1/projects/{project_id}/tasks/{task_id}/comments` — получение ленты комментариев
  - `POST /api/v1/projects/{project_id}/tasks/{task_id}/comments` — добавление комментария (`LEADER` и `MEMBER`, наблюдателю запрещено)
  - `DELETE /api/v1/projects/{project_id}/tasks/{task_id}/comments/{comment_id}` — мягкое удаление комментария (автором или руководителем проекта)
- Живой блок обсуждения внутри модального окна карточки задачи (`TaskDetailsModal`) с автоматическим обновлением счётчика комментариев на карточках канбан-доски
