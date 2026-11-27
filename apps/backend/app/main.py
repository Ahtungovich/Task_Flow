import hashlib
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.activity_hooks import current_actor_id_var, register_activity_hooks
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import UserSession, utc_now
# !! Подключён новый роутер notifications для внутренних уведомлений о заданиях и дедлайнах (Этап 12)
from app.routers import (
    activity,
    admin,
    attachments,
    auth,
    comments,
    health,
    notifications,
    projects,
    tasks,
    users,
)
from app.schemas import to_iso

# !! Регистрируем слушатель ORM и создаём недостающие таблицы (включая notifications) при запуске сервера (Этап 12)
register_activity_hooks()
Base.metadata.create_all(bind=engine)

# создаем главный экземпляр веб-сервера fastapi и включаем автодокументацию swagger
app = FastAPI(
    title=f"{settings.app_name} API",
    version="0.1.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
)

# разрешаем запросы с нашего фронтенда (localhost:5173) и передачу сессионных cookies
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware для определения автора изменений из cookie сессии перед записью в журнал логов и уведомлений
@app.middleware("http")
async def attach_actor_context_middleware(request: Request, call_next):
    actor_id = None
    cookie_name = (
        getattr(settings, "session_cookie_name", None)
        or getattr(settings, "cookie_name", None)
        or "taskflow_session"
    )
    raw_token = request.cookies.get(cookie_name)
    if raw_token:
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            sess = db.execute(
                select(UserSession).where(
                    UserSession.token_hash == token_hash,
                    UserSession.expires_at > now,
                )
            ).scalar_one_or_none()
            if sess:
                actor_id = sess.user_id
        finally:
            db.close()

    token = current_actor_id_var.set(actor_id)
    try:
        return await call_next(request)
    finally:
        current_actor_id_var.reset(token)


# перехватываем стандартные http-ошибки чтобы отдавать их в едином красивом json-формате
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "statusCode": exc.status_code,
            "error": "Http Error",
            "message": exc.detail,
            "path": request.url.path,
            "timestamp": to_iso(utc_now()),
        },
    )


# перехватываем ошибки валидации pydantic (например если ввели короткий пароль или кривой email)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    messages = []
    for err in exc.errors():
        loc = " -> ".join(str(x) for x in err.get("loc", []) if x != "body")
        msg = err.get("msg", "Ошибка валидации")
        messages.append(f"{loc}: {msg}" if loc else msg)

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "statusCode": status.HTTP_400_BAD_REQUEST,
            "error": "Bad Request",
            "message": messages,
            "path": request.url.path,
            "timestamp": to_iso(utc_now()),
        },
    )


# подключаем все модули с роутами под общим префиксом /api/v1
API_PREFIX = "/api/v1"
app.include_router(health.router, prefix=API_PREFIX)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(projects.router, prefix=API_PREFIX)
app.include_router(tasks.router, prefix=API_PREFIX)
app.include_router(comments.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(attachments.router, prefix=API_PREFIX)
app.include_router(activity.router, prefix=API_PREFIX)
# !! Подключаем маршруты уведомлений пользователя (Этап 12)
app.include_router(notifications.router, prefix=API_PREFIX)
