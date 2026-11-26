from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
# !! Добавлен импорт engine и Base для автоматического создания новых таблиц при старте сервера (Этап 10)
from app.database import Base, engine
from app.models import utc_now
# !! Подключён новый роутер attachments для работы с прикреплёнными файлами (Этап 10)
from app.routers import admin, attachments, auth, comments, health, projects, tasks, users
from app.schemas import to_iso

# !! Автоматически создаём недостающие таблицы в PostgreSQL (включая таблицу attachments) при запуске приложения
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
# !! Подключаем маршруты загрузки, скачивания и удаления файлов (Этап 10)
app.include_router(attachments.router, prefix=API_PREFIX)
