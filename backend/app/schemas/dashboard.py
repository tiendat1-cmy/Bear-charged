from typing import List

from pydantic import BaseModel


class TopProductOut(BaseModel):
    product_id: int
    product_name: str
    total_sold: int
    total_revenue: float


class RevenuePointOut(BaseModel):
    label: str    # "07/08" hoặc "2026-08"
    revenue: float


class DashboardOverviewOut(BaseModel):
    total_revenue: float
    today_revenue: float
    total_orders: int
    total_customers: int
    total_products: int
    top_products: List[TopProductOut]
    revenue_last_7_days: List[RevenuePointOut]
    revenue_by_month: List[RevenuePointOut]
