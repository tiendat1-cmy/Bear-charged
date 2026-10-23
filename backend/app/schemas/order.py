from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class OrderStatusEnum(str, Enum):
    pending = "Pending"
    completed = "Completed"
    cancelled = "Cancelled"


class DiscountTypeEnum(str, Enum):
    percent = "percent"   # discount_value là % (0-100)
    amount = "amount"     # discount_value là số tiền VNĐ trực tiếp


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class OrderCreate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None # thêm tên khách hàng
    payment_method: Optional[str] = Field(None, max_length=50)
    items: List[OrderItemCreate] = Field(..., min_length=1)

    # Giảm giá / VAT — backend tự tính và LƯU LẠI (trước đây chỉ hiển thị client)
    discount_type: DiscountTypeEnum = DiscountTypeEnum.amount
    discount_value: float = Field(0, ge=0)
    vat_percent: float = Field(8, ge=0, le=100)


class OrderDetailOut(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    product_barcode: Optional[str] = None
    quantity: int
    price: float

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    code: str                              # "HD00001" - sinh từ id, không lưu DB
    customer_id: Optional[int] = None
    customer_fullname: Optional[str] = None  # lấy từ quan hệ Customer, None nếu khách lẻ
    subtotal: float
    discount_amount: float
    vat_amount: float
    total: float
    payment_method: Optional[str] = None
    status: OrderStatusEnum
    created_at: datetime
    order_details: List[OrderDetailOut] = []
   

    class Config:
        from_attributes = True




class OrderCreateSchema(BaseModel):
    customer_name: Optional[str] = "Khách lẻ"  # Nếu không nhập tự động nhận là Khách lẻ
    payment_method: str = "CASH"              # "CASH" hoặc "QR"
    items: list                               # Danh sách sản phẩm mua