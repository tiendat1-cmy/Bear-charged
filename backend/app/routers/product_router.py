from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_admin
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate
from app.services import product_service
from app.utils.response import success_response

router = APIRouter(prefix="/api/products", tags=["Products"])


@router.get("", dependencies=[Depends(get_current_user)])
def search_products(
    keyword: Optional[str] = Query(None, description="Tìm theo tên sản phẩm hoặc mã vạch"),
    category_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    result = product_service.search_products(db, keyword, category_id, page, page_size)
    data = {
        "items": [ProductOut.model_validate(p).model_dump() for p in result["items"]],
        "meta": result["meta"],
    }
    return success_response("OK", data)


@router.get("/all", dependencies=[Depends(get_current_user)])
def get_all_products(db: Session = Depends(get_db)):
    """Lấy danh sách tất cả sản phẩm (phục vụ in tem mã vạch A4)."""
    items = product_service.get_all_products(db)
    data = [ProductOut.model_validate(p).model_dump() for p in items]
    return success_response("OK", data)


@router.get("/suggest-barcode", dependencies=[Depends(get_current_user)])
def suggest_barcode(db: Session = Depends(get_db)):
    """Gợi ý một mã vạch nội bộ hợp lệ chưa tồn tại trong hệ thống."""
    barcode = product_service.suggest_barcode(db)
    return success_response("OK", {"barcode": barcode})


@router.post("/bulk-auto-barcodes", dependencies=[Depends(require_admin)])
def bulk_auto_barcodes(db: Session = Depends(get_db)):
    """Tự động cấp mã vạch cho tất cả các sản phẩm chưa có mã."""
    result = product_service.bulk_generate_barcodes(db)
    return success_response(
        f"Đã tạo mã vạch cho {result['total_updated']} sản phẩm",
        result,
    )


@router.get("/barcode/{barcode}", dependencies=[Depends(get_current_user)])
def get_product_by_barcode(barcode: str, db: Session = Depends(get_db)):
    product = product_service.get_product_by_barcode(db, barcode)
    return success_response("OK", ProductOut.model_validate(product).model_dump())


@router.post("/{product_id}/auto-barcode", dependencies=[Depends(require_admin)])
def auto_assign_barcode(product_id: int, db: Session = Depends(get_db)):
    """Tự động sinh và gán mã vạch cho một sản phẩm (nếu sản phẩm chưa có mã)."""
    product = product_service.auto_assign_barcode(db, product_id)
    return success_response(
        "Cấp mã vạch thành công",
        ProductOut.model_validate(product).model_dump(),
    )


@router.get("/{product_id}", dependencies=[Depends(get_current_user)])
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = product_service.get_product(db, product_id)
    return success_response("OK", ProductOut.model_validate(product).model_dump())


@router.post("", dependencies=[Depends(require_admin)])
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = product_service.create_product(db, payload)
    return success_response("Tạo sản phẩm thành công", ProductOut.model_validate(product).model_dump())


@router.put("/{product_id}", dependencies=[Depends(require_admin)])
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = product_service.update_product(db, product_id, payload)
    return success_response("Cập nhật thành công", ProductOut.model_validate(product).model_dump())


@router.delete("/{product_id}", dependencies=[Depends(require_admin)])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product_service.delete_product(db, product_id)
    return success_response("Xóa thành công")
