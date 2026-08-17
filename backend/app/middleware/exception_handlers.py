from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.utils.exceptions import AppException
from app.utils.response import error_response


def register_exception_handlers(app: FastAPI) -> None:
    """
    Đăng ký handler cho từng loại lỗi để MỌI response lỗi đều có dạng:
        {"success": false, "message": "...", "data": null}
    thay vì format mặc định của FastAPI/Starlette.
    """

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        return JSONResponse(status_code=exc.status_code, content=error_response(exc.message))

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content=error_response(str(exc.detail)))

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = [
            f"{'.'.join(str(loc) for loc in e['loc'] if loc != 'body')}: {e['msg']}"
            for e in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_response("Dữ liệu không hợp lệ", data=errors),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        # Log lỗi thật ra console để dev debug, nhưng KHÔNG lộ chi tiết ra ngoài
        print(f"[UNHANDLED ERROR] {type(exc).__name__}: {exc}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response("Lỗi hệ thống, vui lòng thử lại sau"),
        )
