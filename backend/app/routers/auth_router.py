from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.user import ChangePasswordRequest, UserLogin, UserOut, UserRegister
from app.services import auth_service
from app.utils.response import success_response

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register")
def register(payload: UserRegister, db: Session = Depends(get_db)):
    user = auth_service.register_user(db, payload)
    return success_response("Đăng ký thành công", UserOut.model_validate(user).model_dump())


@router.post("/login")
def login(payload: UserLogin, db: Session = Depends(get_db)):
    token_data = auth_service.login_user(db, payload)
    return success_response("Đăng nhập thành công", token_data)


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return success_response("OK", UserOut.model_validate(current_user).model_dump())


@router.put("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    auth_service.change_password(db, current_user, payload)
    return success_response("Đổi mật khẩu thành công")
