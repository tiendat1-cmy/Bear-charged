from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    fullname = Column(String(150), nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    email = Column(String(150), nullable=True)
    address = Column(String(255), nullable=True)

    orders = relationship("Order", back_populates="customer")
