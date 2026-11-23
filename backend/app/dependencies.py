from fastapi import (
    Depends,
    HTTPException,
    Request,
    status,
)
from sqlalchemy.orm import Session

from .auth import decode_access_token
from .database import SessionLocal
from .models import User


COOKIE_NAME = "edgepulse_session"


def get_db():
    database = SessionLocal()

    try:
        yield database
    finally:
        database.close()


def get_current_user(
    request: Request,
    database: Session = Depends(
        get_db
    ),
) -> User:
    token = request.cookies.get(
        COOKIE_NAME
    )

    if not token:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail="Not authenticated",
        )

    payload = decode_access_token(
        token
    )

    if not payload:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Invalid or expired session"
            ),
        )

    user_id = payload.get(
        "user_id"
    )

    if user_id is None:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Invalid session payload"
            ),
        )

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Invalid session user"
            ),
        )

    user = (
        database.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "User no longer exists"
            ),
        )

    return user