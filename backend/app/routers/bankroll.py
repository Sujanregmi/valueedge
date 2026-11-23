from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..dependencies import get_db, get_current_user


router = APIRouter(
    prefix="/bankroll",
    tags=["Bankroll"],
)


class BankrollUpdate(BaseModel):
    balance: float = Field(ge=0)


# ============================================================
# GET CURRENT USER BANKROLL
# ============================================================

@router.get("")
def get_bankroll(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bankroll = (
        db.query(models.Bankroll)
        .filter(
            models.Bankroll.user_id == current_user.id
        )
        .first()
    )

    if not bankroll:
        return {
            "id": None,
            "user_id": current_user.id,
            "balance": 0,
        }

    return bankroll


# ============================================================
# CREATE OR UPDATE CURRENT USER BANKROLL
# ============================================================

@router.patch("")
def update_bankroll(
    payload: BankrollUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bankroll = (
        db.query(models.Bankroll)
        .filter(
            models.Bankroll.user_id == current_user.id
        )
        .first()
    )

    if bankroll:
        bankroll.balance = payload.balance

    else:
        bankroll = models.Bankroll(
            user_id=current_user.id,
            balance=payload.balance,
        )

        db.add(bankroll)

    db.commit()
    db.refresh(bankroll)

    return bankroll