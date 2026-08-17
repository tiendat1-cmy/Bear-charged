from typing import Optional

from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.repositories import customer_repository
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.utils.exceptions import AppException


def search_customers(db: Session, keyword: Optional[str], page: int, page_size: int) -> dict:
    items, total_items = customer_repository.search(db, keyword, page, page_size)
    total_pages = (total_items + page_size - 1) // page_size if total_items else 0

    return {
        "items": items,
        "meta": {
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages,
        },
    }


def get_customer(db: Session, customer_id: int) -> Customer:
    customer = customer_repository.get_by_id(db, customer_id)
    if not customer:
        raise AppException(404, "Khách hàng không tồn tại")
    return customer


def create_customer(db: Session, payload: CustomerCreate) -> Customer:
    if payload.phone and customer_repository.get_by_phone(db, payload.phone):
        raise AppException(400, "Số điện thoại đã tồn tại")

    customer = Customer(**payload.model_dump())
    return customer_repository.create(db, customer)


def update_customer(db: Session, customer_id: int, payload: CustomerUpdate) -> Customer:
    customer = get_customer(db, customer_id)
    data = payload.model_dump(exclude_unset=True)

    if "phone" in data and data["phone"]:
        existing = customer_repository.get_by_phone(db, data["phone"])
        if existing and existing.id != customer_id:
            raise AppException(400, "Số điện thoại đã tồn tại")

    return customer_repository.update(db, customer, data)


def delete_customer(db: Session, customer_id: int) -> None:
    customer = get_customer(db, customer_id)
    customer_repository.delete(db, customer)
