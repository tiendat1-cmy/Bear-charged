from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import user_repository
from app.schemas.user import ChangePasswordRequest, UserLogin, UserOut, UserRegister
from app.utils.exceptions import AppException
from app.utils.security import create_access_token, hash_password, verify_password


def register_user(db: Session, payload: UserRegister) -> User:
    existing = user_repository.get_user_by_email(db, payload.email)
    if existing:
        raise AppException(400, "Email đã được sử dụng")

    user = User(
        fullname=payload.fullname,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role.value,
    )
    return user_repository.create_user(db, user)


def login_user(db: Session, payload: UserLogin) -> dict:
    user = user_repository.get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise AppException(401, "Email hoặc mật khẩu không đúng")

    access_token = create_access_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserOut.model_validate(user).model_dump(),
    }


def change_password(db: Session, current_user: User, payload: ChangePasswordRequest) -> None:
    if not verify_password(payload.old_password, current_user.password_hash):
        raise AppException(400, "Mật khẩu cũ không đúng")

    user_repository.update_user_password(db, current_user, hash_password(payload.new_password))
