from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import jwt

from app.config import settings


def hash_password(password: str) -> str:
    """
    Dùng thẳng thư viện bcrypt (KHÔNG qua passlib).
    Lý do: passlib đã ngừng bảo trì từ ~2020 và không tương thích với
    bcrypt>=4.1 (lỗi AttributeError module 'bcrypt' has no attribute
    '__about__' — bug đã biết, không có bản vá chính thức). Gọi thẳng
    bcrypt tránh được lớp trung gian lỗi thời này, đồng thời luôn dùng
    được bản bcrypt mới nhất (có sẵn wheel cho mọi bản Python mới).
    bcrypt chỉ dùng 72 byte đầu của mật khẩu — đủ dùng cho hầu hết trường hợp.
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Ném jose.JWTError nếu token không hợp lệ / hết hạn — caller tự bắt."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
