from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.repositories import customer_repository, order_repository, product_repository


def get_overview(db: Session) -> dict:
    total_revenue = order_repository.sum_total_revenue(db)      # tổng từ trước đến giờ - GIỮ NGUYÊN, không reset
    today_revenue = order_repository.sum_today_revenue(db)
    week_revenue = order_repository.sum_current_week_revenue(db)  # MỚI - doanh thu tuần lịch hiện tại
    total_orders = order_repository.count_all_orders(db)
    total_customers = customer_repository.count_all(db)
    total_products = product_repository.count_all(db)
    top_products = order_repository.top_selling_products(db, limit=5)
 
    # Đổi từ "7 ngày cuốn chiếu" sang "tuần lịch thật" (Thứ 2 -> CN, reset mỗi tuần mới)
    revenue_days = order_repository.revenue_current_week(db)
    revenue_last_7_days = _fill_current_week(revenue_days)
 
    revenue_months = order_repository.revenue_by_month(db, n_months=6)
    revenue_by_month = [
        {"label": row["month"], "revenue": row["revenue"]} for row in revenue_months
    ]
 
    return {
        "total_revenue": total_revenue,
        "today_revenue": today_revenue,
        "week_revenue": week_revenue,  # MỚI - frontend dùng nếu muốn thêm ô hiển thị
        "total_orders": total_orders,
        "total_customers": total_customers,
        "total_products": total_products,
        "top_products": top_products,
        "revenue_last_7_days": revenue_last_7_days,  # giữ nguyên tên field để dashboard.js không cần sửa
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


def _fill_current_week(rows: list) -> list:
    """rows đã có đủ 7 ngày (Thứ 2 -> CN) từ revenue_current_week, chỉ cần format lại label."""
    result = []
    for row in rows:
        day = row["day"]
        result.append(
            {
                "label": day.strftime("%d/%m"),
                "date": str(day),
                "revenue": row["revenue"],
            }
        )
    return result
