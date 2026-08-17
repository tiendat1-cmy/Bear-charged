from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.repositories import user_repository
from app.utils.exceptions import AppException
from app.utils.security import decode_access_token

# tokenUrl chỉ dùng để hiển thị nút "Authorize" trên Swagger UI
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Giải mã JWT, lấy user tương ứng. Raise 401 nếu token/user không hợp lệ."""
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise AppException(401, "Token không hợp lệ hoặc đã hết hạn")

    email = payload.get("sub")
    if email is None:
        raise AppException(401, "Token không hợp lệ")

    user = user_repository.get_user_by_email(db, email)
    if user is None:
        raise AppException(401, "Người dùng không tồn tại")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dùng làm Depends() cho các endpoint chỉ Admin mới được thực hiện."""
    if current_user.role != UserRole.admin:
        raise AppException(403, "Chỉ Admin mới có quyền thực hiện thao tác này")
    return current_user
