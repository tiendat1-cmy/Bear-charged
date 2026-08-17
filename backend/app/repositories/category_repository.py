from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.category import Category


def get_all(db: Session) -> List[Category]:
    return db.query(Category).order_by(Category.name).all()


def get_by_id(db: Session, category_id: int) -> Optional[Category]:
    return db.query(Category).filter(Category.id == category_id).first()


def get_by_name(db: Session, name: str) -> Optional[Category]:
    return db.query(Category).filter(Category.name == name).first()


def create(db: Session, category: Category) -> Category:
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update(db: Session, category: Category, name: str) -> Category:
    category.name = name
    db.commit()
    db.refresh(category)
    return category


def delete(db: Session, category: Category) -> None:
    db.delete(category)
    db.commit()
