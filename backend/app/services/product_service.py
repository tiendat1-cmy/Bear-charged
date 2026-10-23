import random
import time
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.product import Product
from app.repositories import product_repository
from app.schemas.product import ProductCreate, ProductUpdate
from app.utils.exceptions import AppException


def _calculate_ean13_checksum(code12: str) -> str:
    """Tính số kiểm tra EAN-13 (check digit) cho 12 chữ số đầu."""
    odd_sum = sum(int(code12[i]) for i in range(0, 12, 2))
    even_sum = sum(int(code12[i]) for i in range(1, 12, 2)) * 3
    total = odd_sum + even_sum
    check_digit = (10 - (total % 10)) % 10
    return str(check_digit)


def generate_unique_barcode(db: Session, prefix: str = "200") -> str:
    """
    Sinh mã vạch nội bộ 13 số chuẩn EAN-13 / Code 128 duy nhất trong hệ thống.
    Tiền tố 200..299 theo quy ước GS1 dành riêng cho phân phối nội bộ cửa hàng.
    Mã vạch được lưu dưới dạng chuỗi String, giữ nguyên số 0 ở đầu.
    """
    for _ in range(100):
        # 3 số prefix + 6 số thời gian + 3 số ngẫu nhiên = 12 chữ số
        timestamp_part = str(int(time.time()))[-6:]
        random_part = f"{random.randint(0, 999):03d}"
        code12 = f"{prefix}{timestamp_part}{random_part}"[:12]
        if len(code12) < 12:
            code12 = code12.ljust(12, "0")
        check_digit = _calculate_ean13_checksum(code12)
        barcode = f"{code12}{check_digit}"

        # Đảm bảo mã chưa tồn tại trong cơ sở dữ liệu
        if not product_repository.get_by_barcode(db, barcode):
            return barcode

    # Fallback dự phòng
    fallback12 = f"{prefix}{random.randint(100000000, 999999999)}"[:12]
    return f"{fallback12}{_calculate_ean13_checksum(fallback12)}"


def suggest_barcode(db: Session) -> str:
    """Trả về một mã vạch gợi ý hợp lệ và chưa từng xuất hiện."""
    return generate_unique_barcode(db)


def auto_assign_barcode(db: Session, product_id: int) -> Product:
    """
    Tự động cấp mã vạch nội bộ cho sản phẩm nếu sản phẩm chưa có mã.
    Tuyệt đối không ghi đè mã vạch đã có của sản phẩm.
    """
    product = get_product(db, product_id)
    if product.barcode and product.barcode.strip():
        raise AppException(400, f"Sản phẩm đã có mã vạch: {product.barcode}")

    new_barcode = generate_unique_barcode(db)
    return product_repository.update(db, product, {"barcode": new_barcode})


def bulk_generate_barcodes(db: Session) -> dict:
    """Tự động sinh mã vạch cho tất cả sản phẩm hiện chưa có mã vạch."""
    products = product_repository.get_products_without_barcode(db)
    updated_items = []
    for p in products:
        new_barcode = generate_unique_barcode(db)
        product_repository.update(db, p, {"barcode": new_barcode})
        updated_items.append({"id": p.id, "name": p.name, "barcode": new_barcode})

    return {
        "total_updated": len(updated_items),
        "items": updated_items,
    }


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


def get_all_products(db: Session) -> List[Product]:
    """Lấy danh sách tất cả sản phẩm (cho trang in tem A4 và POS)."""
    return product_repository.get_all(db)


def get_product(db: Session, product_id: int) -> Product:
    product = product_repository.get_by_id(db, product_id)
    if not product:
        raise AppException(404, "Sản phẩm không tồn tại")
    return product


def get_product_by_barcode(db: Session, barcode: str) -> Product:
    barcode_clean = str(barcode).strip() if barcode is not None else ""
    if not barcode_clean:
        raise AppException(400, "Mã vạch không hợp lệ")
    product = product_repository.get_by_barcode(db, barcode_clean)
    if not product:
        raise AppException(404, f"Không tìm thấy sản phẩm với mã vạch: {barcode_clean}")
    return product


def create_product(db: Session, payload: ProductCreate) -> Product:
    # Xử lý barcode dạng chuỗi, bảo toàn số 0 ở đầu
    data = payload.model_dump()
    raw_barcode = data.get("barcode")
    if raw_barcode is not None:
        barcode_clean = str(raw_barcode).strip()
        if barcode_clean:
            if product_repository.get_by_barcode(db, barcode_clean):
                raise AppException(400, "Barcode đã tồn tại")
            data["barcode"] = barcode_clean
        else:
            data["barcode"] = None
    else:
        data["barcode"] = None

    product = Product(**data)
    return product_repository.create(db, product)


def update_product(db: Session, product_id: int, payload: ProductUpdate) -> Product:
    product = get_product(db, product_id)

    data = payload.model_dump(exclude_unset=True)

    if "barcode" in data:
        raw_barcode = data["barcode"]
        if raw_barcode is not None:
            barcode_clean = str(raw_barcode).strip()
            if barcode_clean:
                existing = product_repository.get_by_barcode(db, barcode_clean)
                if existing and existing.id != product_id:
                    raise AppException(400, "Barcode đã tồn tại")
                data["barcode"] = barcode_clean
            else:
                data["barcode"] = None
        else:
            data["barcode"] = None

    return product_repository.update(db, product, data)


def delete_product(db: Session, product_id: int) -> None:
    product = get_product(db, product_id)
    product_repository.delete(db, product)

