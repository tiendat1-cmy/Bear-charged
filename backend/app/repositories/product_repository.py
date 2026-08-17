from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.product import Product


def get_by_id(db: Session, product_id: int) -> Optional[Product]:
    return db.query(Product).filter(Product.id == product_id).first()


def get_by_barcode(db: Session, barcode: str) -> Optional[Product]:
    return db.query(Product).filter(Product.barcode == barcode).first()


def search(
    db: Session,
    keyword: Optional[str],
    category_id: Optional[int],
    page: int,
    page_size: int,
) -> Tuple[List[Product], int]:
    """Trả về (danh sách sản phẩm của trang hiện tại, tổng số sản phẩm khớp điều kiện)."""
    query = db.query(Product)

    if keyword:
        query = query.filter(Product.name.ilike(f"%{keyword}%"))

    if category_id:
        query = query.filter(Product.category_id == category_id)

    total_items = query.count()

    items = (
        query.order_by(Product.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return items, total_items


def create(db: Session, product: Product) -> Product:
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update(db: Session, product: Product, data: dict) -> Product:
    for field, value in data.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


def delete(db: Session, product: Product) -> None:
    db.delete(product)
    db.commit()


def count_all(db: Session) -> int:
    return db.query(Product).count()


def get_low_and_out_of_stock(db: Session, low_stock_threshold: int = 10) -> List[Product]:
    """Trả về sản phẩm hết hàng hoặc sắp hết hàng (quantity <= threshold), dùng cho Dashboard."""
    return (
        db.query(Product)
        .filter(Product.quantity <= low_stock_threshold)
        .order_by(Product.quantity.asc())
        .all()
    )
