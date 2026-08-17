from sqlalchemy.orm import Session

from app.models.order import Order, OrderDetail, OrderStatus
from app.repositories import order_repository, product_repository
from app.schemas.order import DiscountTypeEnum, OrderCreate
from app.utils.exceptions import AppException


def _calculate_discount(subtotal: float, discount_type: DiscountTypeEnum, discount_value: float) -> float:
    if discount_value <= 0:
        return 0.0

    amount = (subtotal * discount_value / 100) if discount_type == DiscountTypeEnum.percent else discount_value

    # Không cho phép giảm giá vượt quá tạm tính
    return min(amount, subtotal)


def attach_display_fields(order: Order) -> Order:
    """
    Gắn thêm 2 field CHỈ ĐỂ HIỂN THỊ (không lưu DB) vào object Order:
    - code: mã hóa đơn dạng "HD00001", sinh trực tiếp từ id.
    - customer_fullname: tên khách hàng lấy qua quan hệ Customer, None nếu khách lẻ.
    SQLAlchemy object cho phép gán thuộc tính động, Pydantic model_validate
    (from_attributes=True) sẽ đọc được 2 field này bình thường.
    """
    order.code = f"HD{str(order.id).zfill(5)}"
    order.customer_fullname = order.customer.fullname if order.customer else None
    return order


def create_order(db: Session, payload: OrderCreate) -> Order:
    """
    Quy trình tạo đơn hàng (chạy trong 1 transaction duy nhất):
    1. Kiểm tra tồn kho từng sản phẩm, fail fast nếu thiếu hàng.
    2. Trừ tồn kho + tính subtotal dựa trên GIÁ HIỆN TẠI trong DB.
    3. Tính discount_amount / vat_amount / total từ discount_type,
       discount_value, vat_percent do client gửi lên, rồi LƯU LẠI hết
       vào Order (trước đây các số này chỉ hiển thị ở client, không lưu).
    4. Lưu Order + OrderDetail.
    5. Rollback toàn bộ nếu có lỗi bất kỳ bước nào.
    """
    try:
        products_cache = {}

        for item in payload.items:
            product = product_repository.get_by_id(db, item.product_id)
            if not product:
                raise AppException(404, f"Sản phẩm id={item.product_id} không tồn tại")
            if product.quantity < item.quantity:
                raise AppException(
                    400,
                    f"Sản phẩm '{product.name}' không đủ tồn kho "
                    f"(còn {product.quantity}, yêu cầu {item.quantity})",
                )
            products_cache[item.product_id] = product

        subtotal = 0.0
        order_details = []

        for item in payload.items:
            product = products_cache[item.product_id]
            product.quantity -= item.quantity

            line_total = product.price * item.quantity
            subtotal += line_total

            order_details.append(
                OrderDetail(product_id=product.id, quantity=item.quantity, price=product.price)
            )

        discount_amount = _calculate_discount(subtotal, payload.discount_type, payload.discount_value)
        amount_after_discount = subtotal - discount_amount
        vat_amount = amount_after_discount * payload.vat_percent / 100
        total = amount_after_discount + vat_amount

        order = Order(
            customer_id=payload.customer_id,
            subtotal=subtotal,
            discount_amount=discount_amount,
            vat_amount=vat_amount,
            total=total,
            payment_method=payload.payment_method,
            status=OrderStatus.pending,
        )

        created_order = order_repository.create_order_with_details(db, order, order_details)
        # load lại customer (nếu có) để gắn code/customer_fullname cho response
        created_order = order_repository.get_by_id(db, created_order.id)
        return attach_display_fields(created_order)

    except AppException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise AppException(500, "Không thể tạo đơn hàng, vui lòng thử lại") from exc


def get_order(db: Session, order_id: int) -> Order:
    order = order_repository.get_by_id(db, order_id)
    if not order:
        raise AppException(404, "Đơn hàng không tồn tại")
    return attach_display_fields(order)


def list_orders(db: Session, page: int, page_size: int) -> dict:
    items, total_items = order_repository.get_all(db, page, page_size)
    items = [attach_display_fields(o) for o in items]
    total_pages = (total_items + page_size - 1) // page_size if total_items else 0

    return {
        "items": items,
        "meta": {
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages,
        },
    }


def list_recent_orders(db: Session, limit: int = 5) -> list:
    orders = order_repository.get_recent(db, limit)
    return [attach_display_fields(o) for o in orders]
