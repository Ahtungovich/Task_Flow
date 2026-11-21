# TaskFlow — Этап 4 (Задачи, приоритеты, сроки, метки и серверные права)

## Что реализовано на Этапе 4
- REST API задач внутри проекта (`GET/POST /projects/:projectId/tasks`, `GET/PATCH/DELETE /projects/:projectId/tasks/:taskId`, `PATCH /projects/:projectId/tasks/:taskId/status`)
- REST API меток проекта (`GET/POST/DELETE /projects/:projectId/labels`)
- 6 статусов задач (`NEW`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `BLOCKED`, `POSTPONED`) и 4 приоритета (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- Автоматический расчёт признака просрочки (`isOverdue = deadline < now && status !== DONE`) без изменения статуса задачи
- Строгая серверная проверка ролей:
  - Руководитель (`LEADER`) — полный доступ к задачам, назначению исполнителей, статусам, меткам и удалению
  - Участник (`MEMBER`) — создание задач без назначения исполнителя, редактирование и удаление только собственных задач (`authorId === userId`), смена статуса только назначенных ему задач
  - Наблюдатель (`OBSERVER`) — только просмотр задач и меток
- Типизированный клиент `tasksApi` на frontend (готов к подключению канбан-доски на Этапе 5)
