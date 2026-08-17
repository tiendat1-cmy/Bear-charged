from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.schemas.payment import PaymentCreate, PaymentOut
from app.services import payment_service
from app.utils.response import success_response

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.post("", dependencies=[Depends(get_current_user)])
def create_payment(payload: PaymentCreate, db: Session = Depends(get_db)):
    payment = payment_service.create_payment(db, payload)
    return success_response("Ghi nhận thanh toán thành công", PaymentOut.model_validate(payment).model_dump())


@router.get("/order/{order_id}", dependencies=[Depends(get_current_user)])
def get_payments_by_order(order_id: int, db: Session = Depends(get_db)):
    payments = payment_service.get_payments_by_order(db, order_id)
    data = [PaymentOut.model_validate(p).model_dump() for p in payments]
    return success_response("OK", data)
