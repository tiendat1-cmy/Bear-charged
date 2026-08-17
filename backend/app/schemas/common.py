"""
Schema dùng chung cho toàn bộ API (không bắt buộc dùng làm response_model,
vì router trả dict qua app/utils/response.py — file này chủ yếu để tham
chiếu format và dùng cho phân trang).
"""

from typing import Optional, Any, List
from pydantic import BaseModel


class ResponseModel(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class PaginatedResult(BaseModel):
    items: List[Any]
    meta: PaginationMeta
