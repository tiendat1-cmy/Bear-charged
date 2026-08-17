import enum

from sqlalchemy import Column, Integer, String, DateTime, Enum, func

from app.database import Base


class UserRole(str, enum.Enum):
    admin = "Admin"
    staff = "Staff"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    fullname = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.staff, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
