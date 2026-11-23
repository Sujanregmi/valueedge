import os

from datetime import (
    datetime,
    timedelta,
    timezone,
)

from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext


load_dotenv()


JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY"
)

if not JWT_SECRET_KEY:
    raise ValueError(
        "JWT_SECRET_KEY is missing "
        "from the .env file"
    )


JWT_ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = (
    60 * 24 * 7
)


password_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def hash_password(
    password: str,
) -> str:
    return password_context.hash(
        password
    )


def verify_password(
    password: str,
    hashed_password: str,
) -> bool:
    try:
        return password_context.verify(
            password,
            hashed_password,
        )
    except Exception:
        return False


def create_access_token(
    data: dict,
    expires_delta: (
        timedelta | None
    ) = None,
) -> str:
    payload = data.copy()

    expires_at = (
        datetime.now(timezone.utc)
        + (
            expires_delta
            or timedelta(
                minutes=(
                    ACCESS_TOKEN_EXPIRE_MINUTES
                )
            )
        )
    )

    payload["exp"] = expires_at

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(
    token: str,
) -> dict | None:
    try:
        return jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[
                JWT_ALGORITHM
            ],
        )

    except JWTError:
        return None