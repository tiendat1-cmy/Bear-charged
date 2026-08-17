from typing import Optional

from sqlalchemy.orm import Session

from app.models.product import Product
from app.repositories import product_repository
from app.schemas.product import ProductCreate, ProductUpdate
from app.utils.exceptions import AppException


def search_products(
    db: Session,
    keyword: Optional[str],
    category_id: Optional[int],
    page: int,
    page_size: int,
) -> dict:
    items, total_items = product_repository.search(db, keyword, category_id, page, page_size)
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


def get_product(db: Session, product_id: int) -> Product:
    product = product_repository.get_by_id(db, product_id)
    if not product:
        raise AppException(404, "Sản phẩm không tồn tại")
    return product


def create_product(db: Session, payload: ProductCreate) -> Product:
    if payload.barcode and product_repository.get_by_barcode(db, payload.barcode):
        raise AppException(400, "Barcode đã tồn tại")

    product = Product(**payload.model_dump())
    return product_repository.create(db, product)


def update_product(db: Session, product_id: int, payload: ProductUpdate) -> Product:
    product = get_product(db, product_id)

    data = payload.model_dump(exclude_unset=True)

    if "barcode" in data and data["barcode"]:
        existing = product_repository.get_by_barcode(db, data["barcode"])
        if existing and existing.id != product_id:
            raise AppException(400, "Barcode đã tồn tại")

    return product_repository.update(db, product, data)


def delete_product(db: Session, product_id: int) -> None:
    product = get_product(db, product_id)
    product_repository.delete(db, product)
