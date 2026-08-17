from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class PaymentMethodEnum(str, Enum):
    cash = "Cash"
    bank_transfer = "Bank Transfer"
    qr = "QR"


class PaymentCreate(BaseModel):
    order_id: int
    method: PaymentMethodEnum
    amount: float = Field(..., gt=0)


class PaymentOut(BaseModel):
    id: int
    order_id: int
    method: str
    amount: float
    created_at: datetime

    class Config:
        from_attributes = True
