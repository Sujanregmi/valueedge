from contextlib import (
    asynccontextmanager,
)

from fastapi import FastAPI
from fastapi.middleware.cors import (
    CORSMiddleware,
)

from . import models
from .authRouter import (
    router as auth_router,
)
from .database import Base, engine
from .routers import (
    bankroll,
    bets,
    bookmakers,
    odds,
    valuebets,
)
#from .routers.valuebets import (
    #start_automatic_scanner,
#)


# Importing models above registers all
# SQLAlchemy tables with Base.
Base.metadata.create_all(
    bind=engine
)


@asynccontextmanager
async def lifespan(
    app: FastAPI,
):
    print(
        "Starting EdgePulse..."
    )

    try:
        start_automatic_scanner()
    except Exception as error:
        # The odds scanner should not stop
        # authentication from starting.
        print(
            "Automatic scanner "
            "failed to start:",
            repr(error),
        )

    yield

    print(
        "Stopping EdgePulse..."
    )


app = FastAPI(
    title="EdgePulse API",
    description=(
        "Betting analytics backend"
    ),
    version="1.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.103:3000",  # your LAN origin
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication routes:
# /auth/register
# /auth/login
# /auth/me
# /auth/logout
app.include_router(
    auth_router
)


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


@app.get("/")
def home():
    return {
        "message":
            "EdgePulse API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }