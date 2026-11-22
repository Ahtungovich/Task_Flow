from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import utc_now
from app.schemas import to_iso

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
def check_health(db: Session = Depends(get_db)) -> dict:
    # тестовый запрос select 1 чтобы убедиться что база данных живая и отвечает
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Нет подключения к базе данных PostgreSQL.",
        ) from exc

    return {
        "status": "ok",
        "appName": settings.app_name,
        "environment": settings.node_env,
        "database": "connected",
        "timestamp": to_iso(utc_now()),
    }
