import os

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    status,
)
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
)
from sqlalchemy.exc import (
    IntegrityError,
)
from sqlalchemy.orm import Session

from .auth import (
    create_access_token,
    hash_password,
    verify_password,
)
from .dependencies import (
    COOKIE_NAME,
    get_current_user,
    get_db,
)
from .models import User


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


COOKIE_MAX_AGE_SECONDS = (
    60 * 60 * 24 * 7
)


# False locally over HTTP.
# Set COOKIE_SECURE=true in production.
COOKIE_SECURE = (
    os.getenv(
        "COOKIE_SECURE",
        "false",
    ).lower()
    == "true"
)


class RegisterRequest(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    name: str
    email: str


class MessageOut(BaseModel):
    message: str


def set_session_cookie(
    response: Response,
    user_id: int,
) -> None:
    token = create_access_token(
        {
            "user_id": user_id,
        }
    )

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=(
            COOKIE_MAX_AGE_SECONDS
        ),
        path="/",
    )


@router.post(
    "/register",
    response_model=UserOut,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def register(
    payload: RegisterRequest,
    response: Response,
    database: Session = Depends(
        get_db
    ),
):
    normalized_email = (
        payload.email
        .strip()
        .lower()
    )

    normalized_name = (
        payload.name.strip()
    )

    if not normalized_name:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail="Name is required",
        )

    existing_user = (
        database.query(User)
        .filter(
            User.email
            == normalized_email
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "An account with this "
                "email already exists"
            ),
        )

    user = User(
        name=normalized_name,
        email=normalized_email,
        hashed_password=(
            hash_password(
                payload.password
            )
        ),
    )

    try:
        database.add(user)
        database.commit()
        database.refresh(user)

    except IntegrityError:
        database.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "An account with this "
                "email already exists"
            ),
        )

    except Exception:
        database.rollback()
        raise

    set_session_cookie(
        response,
        user.id,
    )

    return user


@router.post(
    "/login",
    response_model=UserOut,
)
def login(
    payload: LoginRequest,
    response: Response,
    database: Session = Depends(
        get_db
    ),
):
    normalized_email = (
        payload.email
        .strip()
        .lower()
    )

    user = (
        database.query(User)
        .filter(
            User.email
            == normalized_email
        )
        .first()
    )

    if (
        not user
        or not verify_password(
            payload.password,
            user.hashed_password,
        )
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Incorrect email "
                "or password"
            ),
        )

    set_session_cookie(
        response,
        user.id,
    )

    return user


@router.get(
    "/me",
    response_model=UserOut,
)
def get_me(
    current_user: User = Depends(
        get_current_user
    ),
):
    return current_user


@router.post(
    "/logout",
    response_model=MessageOut,
)
def logout(
    response: Response,
):
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=COOKIE_SECURE,
        samesite="lax",
    )

    return {
        "message": "Logged out",
    }