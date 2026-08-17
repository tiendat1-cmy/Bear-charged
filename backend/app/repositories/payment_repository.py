from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.payment import Payment


def get_by_order_id(db: Session, order_id: int) -> List[Payment]:
    return db.query(Payment).filter(Payment.order_id == order_id).all()


def sum_paid_amount(db: Session, order_id: int) -> float:
    result = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.order_id == order_id)
        .scalar()
    )
    return float(result or 0)


def create(db: Session, payment: Payment) -> Payment:
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment
