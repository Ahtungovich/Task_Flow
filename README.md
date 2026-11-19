# TaskFlow — Этап 1 (Базовая инфраструктура)

Адаптивное веб-приложение для совместного планирования задач и управления учебными проектами.

## Стек
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query
- **Backend:** Node.js, NestJS, TypeScript, REST API, class-validator, Helmet, Throttler
- **База данных:** PostgreSQL 16 + Prisma ORM

## Требования к окружению
- Node.js 20+ (или 18.18+)
- npm 9+
- Docker Desktop (для запуска PostgreSQL) либо локально установленный PostgreSQL 15/16

## Пошаговый запуск и проверка Этапа 1

1. **Настройте переменные окружения:**
   ```bash
   cp .env.example .env
   cp apps/backend/.env.example apps/backend/.env
   cp apps/frontend/.env.example apps/frontend/.env
   ```

2. **Поднимите PostgreSQL:**
   ```bash
   docker compose up -d postgres
   ```
   Проверьте статус контейнера: `docker compose ps` (статус должен быть `healthy`).

3. **Установите зависимости backend и frontend:**
   ```bash
   npm run install:all
   ```

4. **Сгенерируйте Prisma Client и примените первую миграцию:**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```
   *(При запросе имени миграции введите `init`.)*

5. **Запустите backend (в первом терминале):**
   ```bash
   npm run dev:backend
   ```
   Проверка API: откройте `http://localhost:3000/api/v1/health` или выполните:
   ```bash
   curl http://localhost:3000/api/v1/health
   ```
   Ожидаемый ответ: HTTP 200 с `"status":"ok"` и `"database":"connected"`.

6. **Запустите frontend (во втором терминале):**
   ```bash
   npm run dev:frontend
   ```
   Откройте в браузере `http://localhost:5173` и убедитесь, что отображается статус подключения к Backend и PostgreSQL.
