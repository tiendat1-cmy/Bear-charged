from typing import List, Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.customer import Customer


def get_by_id(db: Session, customer_id: int) -> Optional[Customer]:
    return db.query(Customer).filter(Customer.id == customer_id).first()


def get_by_phone(db: Session, phone: str) -> Optional[Customer]:
    return db.query(Customer).filter(Customer.phone == phone).first()


def search(
    db: Session,
    keyword: Optional[str],
    page: int,
    page_size: int,
) -> Tuple[List[Customer], int]:
    query = db.query(Customer)

    if keyword:
        query = query.filter(
            or_(
                Customer.fullname.ilike(f"%{keyword}%"),
                Customer.phone.ilike(f"%{keyword}%"),
            )
        )

    total_items = query.count()

    items = (
        query.order_by(Customer.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return items, total_items


def create(db: Session, customer: Customer) -> Customer:
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def update(db: Session, customer: Customer, data: dict) -> Customer:
    for field, value in data.items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


def delete(db: Session, customer: Customer) -> None:
    db.delete(customer)
    db.commit()


def count_all(db: Session) -> int:
    return db.query(Customer).count()
