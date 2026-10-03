from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.services import dashboard_service
from app.utils.response import success_response
from datetime import date
from fastapi import Query
from app.models.order import OrderStatus
from app.repositories import order_repository

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/notifications", dependencies=[Depends(get_current_user)])
def get_notifications(db: Session = Depends(get_db)):
    """Thông báo tồn kho (hết hàng / sắp hết hàng), sinh trực tiếp từ Product."""
    notifications = dashboard_service.get_notifications(db)
    return success_response("OK", notifications)


@router.get("/overview", dependencies=[Depends(get_current_user)])
def get_overview(db: Session = Depends(get_db)):
    """
    Trả về toàn bộ số liệu dashboard trong 1 lần gọi:
    tổng doanh thu, doanh thu hôm nay, tổng đơn hàng, tổng khách hàng,
    tổng sản phẩm, top sản phẩm bán chạy, doanh thu 7 ngày, doanh thu theo tháng.
    """
    overview = dashboard_service.get_overview(db)
    return success_response("OK", overview)


@router.get("/revenue-by-day", dependencies=[Depends(get_current_user)])
def revenue_by_day(day: date = Query(..., alias="date"), db: Session = Depends(get_db)):
    """Chi tiết 1 ngày: tổng doanh thu, số đơn, từng đơn (ai mua, mua gì)."""
    orders = order_repository.get_orders_by_day(db, day)  # <-- đổi tên hàm
    paid = [o for o in orders if o["status"] == OrderStatus.completed.value]
    return success_response("OK", {
        "date": str(day),
        "total_revenue": sum(o["total"] for o in paid),
        "total_orders": len(paid),
        "orders": orders,
    })


@router.get("/customers", dependencies=[Depends(get_current_user)])
def customer_stats(db: Session = Depends(get_db)):
    return success_response("OK", order_repository.get_customer_stats(db))

@router.get("/customers/{customer_id}/orders", dependencies=[Depends(get_current_user)])
def customer_orders(customer_id: int, db: Session = Depends(get_db)):
    return success_response("OK", order_repository.get_orders_by_customer(db, customer_id)) 