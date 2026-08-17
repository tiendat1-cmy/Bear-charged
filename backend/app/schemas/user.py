from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class UserRoleEnum(str, Enum):
    admin = "Admin"
    staff = "Staff"


class UserRegister(BaseModel):
    fullname: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRoleEnum = UserRoleEnum.staff


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)


class UserOut(BaseModel):
    id: int
    fullname: str
    email: EmailStr
    role: UserRoleEnum
    created_at: datetime

    class Config:
        from_attributes = True


class TokenData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
