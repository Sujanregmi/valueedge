import os

import requests
from dotenv import load_dotenv


load_dotenv()


ODDSPAPI_KEY = os.getenv(
    "ODDSPAPI_KEY"
)

BASE_URL = (
    "https://odds-api1.p.rapidapi.com"
)

RAPIDAPI_HOST = (
    "odds-api1.p.rapidapi.com"
)


def _headers() -> dict:
    if not ODDSPAPI_KEY:
        raise ValueError(
            "ODDSPAPI_KEY is missing "
            "from .env"
        )

    return {
        "Content-Type":
            "application/json",

        "x-rapidapi-host":
            RAPIDAPI_HOST,

        "x-rapidapi-key":
            ODDSPAPI_KEY,
    }


def _get(
    endpoint: str,
    params: dict | None = None,
):
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=_headers(),
        params=params or {},
        timeout=30,
    )

    print(
        "OddsPapi request:",
        endpoint,
    )

    print(
        "Status:",
        response.status_code,
    )

    # Helpful for diagnosis without
    # making another request.
    if response.status_code != 200:
        print(
            "Body:",
            response.text[:500],
        )

    response.raise_for_status()

    return response.json()


def get_sports():
    """
    Fetch available sports.
    """

    return _get(
        "/sports"
    )

def get_bookmakers():
    return _get(
        "/bookmakers"
    )