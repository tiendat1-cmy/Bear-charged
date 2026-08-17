from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_admin
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.services import category_service
from app.utils.response import success_response

router = APIRouter(prefix="/api/categories", tags=["Categories"])


@router.get("", dependencies=[Depends(get_current_user)])
def list_categories(db: Session = Depends(get_db)):
    categories = category_service.list_categories(db)
    data = [CategoryOut.model_validate(c).model_dump() for c in categories]
    return success_response("OK", data)


@router.get("/{category_id}", dependencies=[Depends(get_current_user)])
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = category_service.get_category(db, category_id)
    return success_response("OK", CategoryOut.model_validate(category).model_dump())


@router.post("", dependencies=[Depends(require_admin)])
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    category = category_service.create_category(db, payload)
    return success_response("Tạo category thành công", CategoryOut.model_validate(category).model_dump())


@router.put("/{category_id}", dependencies=[Depends(require_admin)])
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    category = category_service.update_category(db, category_id, payload)
    return success_response("Cập nhật thành công", CategoryOut.model_validate(category).model_dump())


@router.delete("/{category_id}", dependencies=[Depends(require_admin)])
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category_service.delete_category(db, category_id)
    return success_response("Xóa thành công")
