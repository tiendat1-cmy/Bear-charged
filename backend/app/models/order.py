import enum

from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, func
from sqlalchemy.orm import relationship

from app.database import Base


class OrderStatus(str, enum.Enum):
    pending = "Pending"       # vừa tạo, chưa thanh toán đủ
    completed = "Completed"   # đã thanh toán đủ
    cancelled = "Cancelled"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    subtotal = Column(Float, nullable=False, default=0)          # tổng tiền hàng trước giảm giá/VAT
    discount_amount = Column(Float, nullable=False, default=0)   # số tiền giảm giá (đã quy đổi ra VNĐ)
    vat_amount = Column(Float, nullable=False, default=0)        # tiền thuế VAT
    total = Column(Float, nullable=False, default=0)             # tổng cuối = subtotal - discount + vat
    payment_method = Column(String(50), nullable=True)
    status = Column(Enum(OrderStatus), default=OrderStatus.pending, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="orders")
    order_details = relationship(
        "OrderDetail", back_populates="order", cascade="all, delete-orphan"
    )
    payments = relationship(
        "Payment", back_populates="order", cascade="all, delete-orphan"
    )


class OrderDetail(Base):
    __tablename__ = "order_details"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)  # giá tại thời điểm bán, không phụ thuộc giá SP sau này

    order = relationship("Order", back_populates="order_details")
    product = relationship("Product", back_populates="order_details")
