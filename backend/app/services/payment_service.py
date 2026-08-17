from sqlalchemy.orm import Session

from app.models.order import OrderStatus
from app.models.payment import Payment
from app.repositories import order_repository, payment_repository
from app.schemas.payment import PaymentCreate
from app.utils.exceptions import AppException


def create_payment(db: Session, payload: PaymentCreate) -> Payment:
    order = order_repository.get_by_id(db, payload.order_id)
    if not order:
        raise AppException(404, "Đơn hàng không tồn tại")

    if order.status == OrderStatus.cancelled:
        raise AppException(400, "Đơn hàng đã bị hủy, không thể thanh toán")

    try:
        payment = Payment(
            order_id=payload.order_id,
            method=payload.method.value,
            amount=payload.amount,
        )
        created_payment = payment_repository.create(db, payment)

        # Nếu tổng tiền đã thanh toán >= tổng đơn hàng -> tự động hoàn tất đơn
        total_paid = payment_repository.sum_paid_amount(db, order.id)
        if total_paid >= order.total and order.status != OrderStatus.completed:
            order_repository.update_status(db, order, OrderStatus.completed)

        return created_payment

    except AppException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise AppException(500, "Không thể ghi nhận thanh toán, vui lòng thử lại") from exc


def get_payments_by_order(db: Session, order_id: int):
    order = order_repository.get_by_id(db, order_id)
    if not order:
        raise AppException(404, "Đơn hàng không tồn tại")
    return payment_repository.get_by_order_id(db, order_id)
