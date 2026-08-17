from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.order import Order, OrderDetail, OrderStatus
from app.models.product import Product


def get_by_id(db: Session, order_id: int) -> Optional[Order]:
    return (
        db.query(Order)
        .options(joinedload(Order.order_details), joinedload(Order.customer))
        .filter(Order.id == order_id)
        .first()
    )


def get_all(db: Session, page: int, page_size: int) -> Tuple[List[Order], int]:
    query = db.query(Order).options(
        joinedload(Order.order_details), joinedload(Order.customer)
    )
    total_items = query.count()
    items = (
        query.order_by(Order.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total_items


def get_recent(db: Session, limit: int = 5) -> List[Order]:
    """Lấy N đơn hàng gần nhất, kèm sẵn Customer -> dùng cho Dashboard."""
    return (
        db.query(Order)
        .options(joinedload(Order.order_details), joinedload(Order.customer))
        .order_by(Order.created_at.desc())
        .limit(limit)
        .all()
    )


def create_order_with_details(
    db: Session, order: Order, details: List[OrderDetail]
) -> Order:
    """
    Lưu Order + toàn bộ OrderDetail trong CÙNG MỘT transaction.
    Việc trừ tồn kho (product.quantity) do service gọi trước đó, cùng chung
    session này, nên nếu có lỗi bất kỳ đâu, gọi db.rollback() ở service sẽ
    hoàn tác được cả 3 thay đổi (order, order_details, product.quantity).
    """
    db.add(order)
    db.flush()  # để lấy order.id trước khi gán cho từng OrderDetail

    for detail in details:
        detail.order_id = order.id
        db.add(detail)

    db.commit()
    db.refresh(order)
    return order


def update_status(db: Session, order: Order, status: OrderStatus) -> Order:
    order.status = status
    db.commit()
    db.refresh(order)
    return order


# ---------------------------------------------------------------------------
# Query phục vụ Dashboard
# ---------------------------------------------------------------------------

def count_all_orders(db: Session) -> int:
    return db.query(Order).count()


def sum_total_revenue(db: Session) -> float:
    result = db.query(func.coalesce(func.sum(Order.total), 0)).filter(
        Order.status == OrderStatus.completed
    ).scalar()
    return float(result or 0)


def sum_today_revenue(db: Session) -> float:
    today_start = datetime.combine(date.today(), datetime.min.time())
    result = (
        db.query(func.coalesce(func.sum(Order.total), 0))
        .filter(Order.status == OrderStatus.completed)
        .filter(Order.created_at >= today_start)
        .scalar()
    )
    return float(result or 0)


def revenue_last_n_days(db: Session, n_days: int = 7) -> List[dict]:
    start_date = date.today() - timedelta(days=n_days - 1)
    start_datetime = datetime.combine(start_date, datetime.min.time())

    rows = (
        db.query(
            func.date(Order.created_at).label("day"),
            func.coalesce(func.sum(Order.total), 0).label("revenue"),
        )
        .filter(Order.status == OrderStatus.completed)
        .filter(Order.created_at >= start_datetime)
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
        .all()
    )

    return [{"day": row.day, "revenue": float(row.revenue)} for row in rows]


def revenue_by_month(db: Session, n_months: int = 6) -> List[dict]:
    rows = (
        db.query(
            func.date_format(Order.created_at, "%Y-%m").label("month"),
            func.coalesce(func.sum(Order.total), 0).label("revenue"),
        )
        .filter(Order.status == OrderStatus.completed)
        .group_by(func.date_format(Order.created_at, "%Y-%m"))
        .order_by(func.date_format(Order.created_at, "%Y-%m").desc())
        .limit(n_months)
        .all()
    )

    return list(reversed([{"month": row.month, "revenue": float(row.revenue)} for row in rows]))


def top_selling_products(db: Session, limit: int = 5) -> List[dict]:
    rows = (
        db.query(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            func.coalesce(func.sum(OrderDetail.quantity), 0).label("total_sold"),
            func.coalesce(func.sum(OrderDetail.quantity * OrderDetail.price), 0).label(
                "total_revenue"
            ),
        )
        .join(OrderDetail, OrderDetail.product_id == Product.id)
        .join(Order, Order.id == OrderDetail.order_id)
        .filter(Order.status == OrderStatus.completed)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(OrderDetail.quantity).desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "product_id": row.product_id,
            "product_name": row.product_name,
            "total_sold": int(row.total_sold),
            "total_revenue": float(row.total_revenue),
        }
        for row in rows
    ]
