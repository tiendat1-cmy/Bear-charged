from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_admin
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate
from app.services import customer_service
from app.utils.response import success_response

router = APIRouter(prefix="/api/customers", tags=["Customers"])


@router.get("", dependencies=[Depends(get_current_user)])
def search_customers(
    keyword: Optional[str] = Query(None, description="Tìm theo tên hoặc số điện thoại"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    result = customer_service.search_customers(db, keyword, page, page_size)
    data = {
        "items": [CustomerOut.model_validate(c).model_dump() for c in result["items"]],
        "meta": result["meta"],
    }
    return success_response("OK", data)


@router.get("/{customer_id}", dependencies=[Depends(get_current_user)])
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = customer_service.get_customer(db, customer_id)
    return success_response("OK", CustomerOut.model_validate(customer).model_dump())


@router.post("", dependencies=[Depends(get_current_user)])
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    customer = customer_service.create_customer(db, payload)
    return success_response("Tạo khách hàng thành công", CustomerOut.model_validate(customer).model_dump())


@router.put("/{customer_id}", dependencies=[Depends(get_current_user)])
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    customer = customer_service.update_customer(db, customer_id, payload)
    return success_response("Cập nhật thành công", CustomerOut.model_validate(customer).model_dump())


@router.delete("/{customer_id}", dependencies=[Depends(require_admin)])
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer_service.delete_customer(db, customer_id)
    return success_response("Xóa thành công")
