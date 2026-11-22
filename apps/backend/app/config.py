import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from dotenv import load_dotenv

# находим папку бэкенда и корень проекта чтобы подхватить файл .env
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ROOT_DIR = _BACKEND_DIR.parent.parent

# грузим переменные окружения из локального .env или из общего в корне
if (_BACKEND_DIR / ".env").exists():
    load_dotenv(_BACKEND_DIR / ".env")
elif (_ROOT_DIR / ".env").exists():
    load_dotenv(_ROOT_DIR / ".env")


def _normalize_sqlalchemy_db_url(raw_url: str) -> str:
    # приводим ссылку на базу к формату sqlalchemy + psycopg и убираем параметр schema
    parsed = urlparse(raw_url.strip())
    scheme = parsed.scheme
    if scheme in ("postgres", "postgresql"):
        scheme = "postgresql+psycopg"

    # выкидываем query-параметр schema так как драйвер psycopg его не понимает
    filtered_query = [
        (k, v) for k, v in parse_qsl(parsed.query) if k.lower() != "schema"
    ]
    new_query = urlencode(filtered_query)
    return urlunparse(parsed._replace(scheme=scheme, query=new_query))


# структура со всеми настройками приложения чтобы удобно обращаться из любого файла
@dataclass(frozen=True)
class Settings:
    node_env: str
    app_name: str
    port: int
    frontend_url: str
    database_url: str
    session_secret: str
    session_ttl_hours: int
    cookie_secure: bool
    auto_approve_teachers: bool
    email_verification_required: bool


def load_settings() -> Settings:
    # проверяем что адрес базы вообще задан иначе запускаться нет смысла
    raw_db_url = os.getenv("DATABASE_URL", "").strip()
    if not raw_db_url:
        raise RuntimeError(
            "Переменная окружения DATABASE_URL обязательна и не задана в .env."
        )

    # секретный ключ нужен для подписи токенов сессий поэтому он не должен быть коротким
    session_secret = os.getenv("SESSION_SECRET", "").strip()
    if len(session_secret) < 16:
        raise RuntimeError(
            "Переменная окружения SESSION_SECRET обязательна (минимум 16 символов)."
        )

    # собираем итоговый конфиг со значениями по умолчанию на случай если чего-то нет в .env
    return Settings(
        node_env=os.getenv("NODE_ENV", "development"),
        app_name=os.getenv("APP_NAME", "TaskFlow"),
        port=int(os.getenv("PORT", "3000")),
        frontend_url=os.getenv("FRONTEND_URL", "http://localhost:5173"),
        database_url=_normalize_sqlalchemy_db_url(raw_db_url),
        session_secret=session_secret,
        session_ttl_hours=int(os.getenv("SESSION_TTL_HOURS", "168")),
        cookie_secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        auto_approve_teachers=os.getenv("AUTO_APPROVE_TEACHERS", "true").lower()
        == "true",
        email_verification_required=os.getenv(
            "EMAIL_VERIFICATION_REQUIRED", "false"
        ).lower()
        == "true",
    )


# создаем готовый объект настроек один раз при старте сервера
settings = load_settings()
