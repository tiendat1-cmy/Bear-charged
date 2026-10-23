from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.order import Order, OrderDetail, OrderStatus
from app.models.product import Product
from app.models.customer import Customer


def get_by_id(db: Session, order_id: int) -> Optional[Order]:
    return (
        db.query(Order)
        .options(
            joinedload(Order.order_details).joinedload(OrderDetail.product),
            joinedload(Order.customer),
        )
        .filter(Order.id == order_id)
        .first()
    )


def get_all(db: Session, page: int, page_size: int) -> Tuple[List[Order], int]:
    query = db.query(Order).options(
        joinedload(Order.order_details).joinedload(OrderDetail.product),
        joinedload(Order.customer),
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
        .options(
            joinedload(Order.order_details).joinedload(OrderDetail.product),
            joinedload(Order.customer),
        )
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


# bổ sung 
def _attach_items(db: Session, orders: List[Order]) -> None:
    """Gắn order_details -> tên sản phẩm (1 query cho tất cả đơn, không phụ thuộc relationship OrderDetail.product)."""
    if not orders:
        return

    order_ids = [o.id for o in orders]
    rows = (
        db.query(OrderDetail.order_id, Product.name, OrderDetail.quantity, OrderDetail.price)
        .join(Product, Product.id == OrderDetail.product_id)
        .filter(OrderDetail.order_id.in_(order_ids))
        .all()
    )
    items_by_order = {}
    for order_id, name, qty, price in rows:
        items_by_order.setdefault(order_id, []).append(
            {"name": name, "quantity": qty, "price": float(price)}
        )

    for o in orders:
        o.items = items_by_order.get(o.id, [])


# app/repositories/order_repository.py
# --- THAY THẾ 3 hàm dưới đây (revenue_last_n_days, get_by_day, get_by_customer) ---
# --- và THÊM MỚI revenue_current_week + sum_current_week_revenue ---


def _serialize_order(order: Order) -> dict:
    """Chuyển 1 Order (kèm order.items do _attach_items gắn sẵn) thành dict
    thuần để trả JSON được, đúng field mà dashboard.js đang đọc
    (code, customer_fullname, items[].name/quantity, total, status)."""
    return {
        "code": f"HD{str(order.id).zfill(5)}",
        "customer_fullname": order.customer.fullname if order.customer else None,
        "items": [{"name": i["name"], "quantity": i["quantity"]} for i in getattr(order, "items", [])],
        "total": float(order.total),
        "status": order.status.value if hasattr(order.status, "value") else order.status,
    }


def get_orders_by_day(db: Session, day: date) -> List[dict]:
    """Toàn bộ đơn hàng tạo trong 1 ngày cụ thể (mọi trạng thái), trả về list[dict]."""
    orders = (
        db.query(Order)
        .options(joinedload(Order.order_details), joinedload(Order.customer))
        .filter(func.date(Order.created_at) == day)
        .order_by(Order.created_at.desc())
        .all()
    )
    _attach_items(db, orders)
    return [_serialize_order(o) for o in orders]


def get_orders_by_customer(db: Session, customer_id: int) -> List[dict]:
    """Toàn bộ đơn hàng của 1 khách, trả về list[dict]."""
    orders = (
        db.query(Order)
        .options(joinedload(Order.order_details), joinedload(Order.customer))
        .filter(Order.customer_id == customer_id)
        .order_by(Order.created_at.desc())
        .all()
    )
    _attach_items(db, orders)
    return [_serialize_order(o) for o in orders]


def revenue_current_week(db: Session) -> List[dict]:
    """Doanh thu từng ngày trong TUẦN LỊCH HIỆN TẠI (Thứ 2 -> CN, tự reset mỗi tuần mới)."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    start_datetime = datetime.combine(monday, datetime.min.time())

    rows = (
        db.query(
            func.date(Order.created_at).label("day"),
            func.coalesce(func.sum(Order.total), 0).label("revenue"),
        )
        .filter(Order.status == OrderStatus.completed)
        .filter(Order.created_at >= start_datetime)
        .group_by(func.date(Order.created_at))
        .all()
    )
    revenue_by_day = {row.day: float(row.revenue) for row in rows}

    result = []
    for i in range(7):
        day = monday + timedelta(days=i)
        result.append({"day": day, "revenue": revenue_by_day.get(day, 0.0)})
    return result


def sum_current_week_revenue(db: Session) -> float:
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    start_datetime = datetime.combine(monday, datetime.min.time())
    result = (
        db.query(func.coalesce(func.sum(Order.total), 0))
        .filter(Order.status == OrderStatus.completed)
        .filter(Order.created_at >= start_datetime)
        .scalar()
    )
    return float(result or 0)


def get_customer_stats(db: Session) -> List[dict]:
    """Mỗi khách: số đơn đã thanh toán (completed) + tổng tiền đã chi."""
    total_spent = func.coalesce(func.sum(Order.total), 0)
    order_count = func.coalesce(
        func.sum(func.if_(Order.status == OrderStatus.completed, 1, 0)), 0
    )

    rows = (
        db.query(Customer.id, Customer.fullname, order_count, total_spent)
        .outerjoin(
            Order,
            (Order.customer_id == Customer.id) & (Order.status == OrderStatus.completed),
        )
        .group_by(Customer.id, Customer.fullname)
        .order_by(total_spent.desc())
        .all()
    )
    return [
        {"id": cid, "fullname": name, "order_count": int(cnt), "total_spent": float(spent)}
        for cid, name, cnt, spent in rows
    ]