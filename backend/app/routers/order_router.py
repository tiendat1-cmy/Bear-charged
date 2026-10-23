from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.schemas.order import OrderCreate, OrderOut
from app.services import order_service
from app.utils.response import success_response

router = APIRouter(prefix="/api/orders", tags=["Orders"])


@router.get("/recent", dependencies=[Depends(get_current_user)])
def get_recent_orders(limit: int = 5, db: Session = Depends(get_db)):
    """Dùng cho Dashboard — trả sẵn code + customer_fullname, không cần bảng orders đầy đủ."""
    orders = order_service.list_recent_orders(db, limit)
    data = [OrderOut.model_validate(o).model_dump() for o in orders]
    return success_response("OK", data)


@router.get("", dependencies=[Depends(get_current_user)])
def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    result = order_service.list_orders(db, page, page_size)
    data = {
        "items": [OrderOut.model_validate(o).model_dump() for o in result["items"]],
        "meta": result["meta"],
    }
    return success_response("OK", data)


@router.get("/{order_id}", dependencies=[Depends(get_current_user)])
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = order_service.get_order(db, order_id)
    return success_response("OK", OrderOut.model_validate(order).model_dump())


@router.get("/{order_id}/print-data", dependencies=[Depends(get_current_user)])
def get_order_print_data(order_id: int, db: Session = Depends(get_db)):
    order = order_service.get_order(db, order_id)
    order_data = OrderOut.model_validate(order).model_dump()
    print_payload = {
        "shop": {
            "name": "BEAR POS",
            "branch": "Cửa hàng tiện lợi Gấu Con",
            "address": "123 Đường ABC, Quận XYZ, TP. Hà Nội",
            "hotline": "1900 1234",
        },
        "order": order_data,
        "is_reprint": True,
    }
    return success_response("OK", print_payload)


@router.post("", dependencies=[Depends(get_current_user)])
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    order = order_service.create_order(db, payload)
    return success_response("Tạo đơn hàng thành công", OrderOut.model_validate(order).model_dump())
