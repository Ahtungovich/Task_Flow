import sys
from pathlib import Path

# добавляем корень бэкенда в sys.path чтобы корректно импортировать app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, or_, select

from app.database import SessionLocal
from app.models import AccountType, User


def main() -> None:
    if len(sys.argv) < 2:
        print("Использование: python scripts/make_admin.py <email_или_username>")
        sys.exit(1)

    identifier = sys.argv[1].strip()
    db = SessionLocal()
    try:
        user = db.execute(
            select(User).where(
                or_(
                    User.email == identifier.lower(),
                    func.lower(User.username) == identifier.lower(),
                )
            )
        ).scalar_one_or_none()

        if not user:
            print(f"Пользователь '{identifier}' не найден.")
            sys.exit(1)

        user.account_type = AccountType.ADMIN
        user.is_teacher_verified = True
        db.add(user)
        db.commit()
        print(
            f"Готово: {user.full_name} (@{user.username}, {user.email}) назначен системным администратором."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
