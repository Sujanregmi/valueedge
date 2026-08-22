from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models import ArbitrageOpportunity
from .database import engine, Base, SessionLocal
from . import models
from .schemas import UserCreate, UserResponse, LoginRequest, Token
from .auth import hash_password, verify_password, create_access_token
from .routers import bookmakers
from .routers import bets
from .routers import bankroll
from .routers import odds
from .routers import valuebets
from contextlib import asynccontextmanager
# Create database tables
from fastapi import FastAPI
Base.metadata.create_all(bind=engine)
from app.routers.valuebets import (
    start_automatic_scanner,
)
@asynccontextmanager
async def lifespan(app: FastAPI):

    print("Starting EdgePulse...")

    start_automatic_scanner()

    yield

    print("Stopping EdgePulse...")



app = FastAPI(
    title="EdgePulse API",
    description="Betting analytics backend",
    version="1.0",
    lifespan=lifespan,
)

app.include_router(valuebets.router)




app.include_router(
    bookmakers.router
)
app.include_router(
    bets.router
)

app.include_router(
    bankroll.router
)
app.include_router(
    odds.router
)
app.include_router(
    valuebets.router
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def home():
    return {
        "message": "EdgePulse API is running"
    }


# Register user
@app.post("/register", response_model=UserResponse)
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    # Check existing email
    existing_user = db.query(models.User).filter(
        models.User.email == user.email
    ).first()


    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )


    # Create new user
    new_user = models.User(
        name=user.name,
        email=user.email,
        hashed_password=hash_password(user.password)
    )


    db.add(new_user)
    db.commit()
    db.refresh(new_user)


    return new_user

# ADD LOGIN HERE 👇
@app.post("/login", response_model=Token)
def login(
    user: LoginRequest,
    db: Session = Depends(get_db)
):

    # Find user by email
    existing_user = db.query(models.User).filter(
        models.User.email == user.email
    ).first()


    if not existing_user:
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password"
        )


    # Check password
    if not verify_password(
        user.password,
        existing_user.hashed_password
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password"
        )


    # Create JWT token
    token = create_access_token(
        {
            "user_id": existing_user.id,
            "email": existing_user.email
        }
    )


    return {
        "access_token": token,
        "token_type": "bearer"
    }