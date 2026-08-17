from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.services import dashboard_service
from app.utils.response import success_response

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
