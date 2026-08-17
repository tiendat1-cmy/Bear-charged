"""
Entry point của ứng dụng FastAPI.

File này CHỈ có nhiệm vụ "lắp ráp": khởi tạo app, gắn middleware,
include router. Toàn bộ business logic nằm ở app/services/.

Chạy dev server:
    uvicorn app.main:app --reload
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.middleware.cors import register_cors
from app.middleware.exception_handlers import register_exception_handlers
from app.routers import (
    auth_router,
    category_router,
    customer_router,
    dashboard_router,
    order_router,
    payment_router,
    product_router,
)
from app.utils.response import success_response

app = FastAPI(
    title="POS Management API",
    description="Backend RESTful API cho hệ thống quản lý bán hàng (POS)",
    version="1.0.0",
)

# ---- Middleware ----
register_cors(app)
register_exception_handlers(app)

# ---- Static files (ảnh sản phẩm upload lên, ví dụ /static/products/abc.jpg) ----
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# ---- Routers ----
app.include_router(auth_router.router)
app.include_router(category_router.router)
app.include_router(product_router.router)
app.include_router(customer_router.router)
app.include_router(order_router.router)
app.include_router(payment_router.router)
app.include_router(dashboard_router.router)


@app.get("/")
def health_check():
    """Kiểm tra nhanh server có sống không (không yêu cầu đăng nhập)."""
    return success_response("POS API is running")
