from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# создаем движок sqlalchemy для работы с postgresql
# pool_pre_ping проверяет живо ли соединение перед запросом чтобы не ловить обрывы
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
)

# фабрика сессий через которую будем делать запросы в базу
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


# базовый класс от которого наследуются все наши таблицы
class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    # открываем сессию бд на время одного http-запроса и гарантированно закрываем в конце
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
