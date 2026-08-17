from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.category import CategoryOut


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    barcode: Optional[str] = Field(None, max_length=100)
    price: float = Field(..., gt=0)
    quantity: int = Field(..., ge=0)
    image: Optional[str] = None
    category_id: Optional[int] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    barcode: Optional[str] = Field(None, max_length=100)
    price: Optional[float] = Field(None, gt=0)
    quantity: Optional[int] = Field(None, ge=0)
    image: Optional[str] = None
    category_id: Optional[int] = None


class ProductOut(BaseModel):
    id: int
    name: str
    barcode: Optional[str] = None
    price: float
    quantity: int
    image: Optional[str] = None
    category_id: Optional[int] = None
    created_at: datetime
    category: Optional[CategoryOut] = None

    class Config:
        from_attributes = True
