from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate


def get_user_by_email(
    database: Session,
    email: str,
) -> User | None:
    normalized_email = email.strip().lower()

    return database.scalar(
        select(User).where(
            func.lower(User.email) == normalized_email
        )
    )


def create_user(
    database: Session,
    user_data: UserCreate,
) -> User:
    user = User(
        email=user_data.email.strip().lower(),
        full_name=user_data.full_name.strip(),
        hashed_password=hash_password(user_data.password),
    )

    database.add(user)
    database.commit()
    database.refresh(user)

    return user


def authenticate_user(
    database: Session,
    email: str,
    password: str,
) -> User | None:
    user = get_user_by_email(database, email)

    if user is None:
        return None

    if not verify_password(
        password,
        user.hashed_password,
    ):
        return None

    return user
