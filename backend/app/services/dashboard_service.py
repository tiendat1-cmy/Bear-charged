from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.repositories import customer_repository, order_repository, product_repository


def get_overview(db: Session) -> dict:
    total_revenue = order_repository.sum_total_revenue(db)
    today_revenue = order_repository.sum_today_revenue(db)
    total_orders = order_repository.count_all_orders(db)
    total_customers = customer_repository.count_all(db)
    total_products = product_repository.count_all(db)
    top_products = order_repository.top_selling_products(db, limit=5)

    revenue_days = order_repository.revenue_last_n_days(db, n_days=7)
    revenue_last_7_days = _fill_missing_days(revenue_days)

    revenue_months = order_repository.revenue_by_month(db, n_months=6)
    revenue_by_month = [
        {"label": row["month"], "revenue": row["revenue"]} for row in revenue_months
    ]

    return {
        "total_revenue": total_revenue,
        "today_revenue": today_revenue,
        "total_orders": total_orders,
        "total_customers": total_customers,
        "total_products": total_products,
        "top_products": top_products,
        "revenue_last_7_days": revenue_last_7_days,
        "revenue_by_month": revenue_by_month,
    }


def get_notifications(db: Session) -> list:
    """Sinh thông báo tồn kho trực tiếp từ Product, không cần bảng notifications riêng."""
    products = product_repository.get_low_and_out_of_stock(db, low_stock_threshold=10)
    notifications = []

    for product in products:
        if product.quantity <= 0:
            notifications.append({
                "type": "danger",
                "icon": "fa-circle-xmark",
                "text": f'Sản phẩm "{product.name}" đã hết hàng',
            })
        else:
            notifications.append({
                "type": "warning",
                "icon": "fa-triangle-exclamation",
                "text": f'Sản phẩm "{product.name}" sắp hết hàng (còn {product.quantity})',
            })

    return notifications


def _fill_missing_days(rows: list) -> list:
    """
    order_repository.revenue_last_n_days chỉ trả về những ngày CÓ đơn hàng.
    Hàm này điền đủ 7 ngày gần nhất (kể cả ngày doanh thu = 0) để vẽ biểu đồ
    không bị đứt quãng.
    """
    revenue_by_day = {str(row["day"]): row["revenue"] for row in rows}

    result = []
    for i in range(6, -1, -1):
        day = date.today() - timedelta(days=i)
        day_str = str(day)
        result.append(
            {
                "label": day.strftime("%d/%m"),
                "revenue": revenue_by_day.get(day_str, 0.0),
            }
        )
    return result
