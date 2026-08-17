from typing import List

from sqlalchemy.orm import Session

from app.models.category import Category
from app.repositories import category_repository
from app.schemas.category import CategoryCreate, CategoryUpdate
from app.utils.exceptions import AppException


def list_categories(db: Session) -> List[Category]:
    return category_repository.get_all(db)


def get_category(db: Session, category_id: int) -> Category:
    category = category_repository.get_by_id(db, category_id)
    if not category:
        raise AppException(404, "Category không tồn tại")
    return category


def create_category(db: Session, payload: CategoryCreate) -> Category:
    if category_repository.get_by_name(db, payload.name):
        raise AppException(400, "Tên category đã tồn tại")
    return category_repository.create(db, Category(name=payload.name))


def update_category(db: Session, category_id: int, payload: CategoryUpdate) -> Category:
    category = get_category(db, category_id)

    duplicated = category_repository.get_by_name(db, payload.name)
    if duplicated and duplicated.id != category_id:
        raise AppException(400, "Tên category đã tồn tại")

    return category_repository.update(db, category, payload.name)


def delete_category(db: Session, category_id: int) -> None:
    category = get_category(db, category_id)
    category_repository.delete(db, category)
