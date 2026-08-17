class AppException(Exception):
    """
    Exception nghiệp vụ tự định nghĩa — dùng thay cho HTTPException ở tầng
    service/repository để không phụ thuộc trực tiếp vào FastAPI ở lớp đó.
    Được app/middleware/exception_handlers.py bắt và trả JSON thống nhất.
    """

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)
