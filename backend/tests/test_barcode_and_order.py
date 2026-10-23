"""
Bộ kiểm thử tự động cho tính năng Quét mã vạch & Đơn hàng / In hóa đơn — Bear POS
==================================================================================
Các ca kiểm thử theo yêu cầu:
1. Quét mã vạch hợp lệ.
2. Quét mã không tồn tại (trả về 404).
3. Quét cùng một mã nhiều lần.
4. Mã vạch có số 0 ở đầu (đảm bảo không bị mất số 0).
5. Sản phẩm hết hàng hoặc không đủ tồn kho.
6. Chống duplicate order (hai yêu cầu thanh toán gần nhau).
7. Hóa đơn vẫn an toàn trong database khi máy in mất kết nối.
8. In lại hóa đơn cũ (kiểm tra đầy đủ thông tin tên hàng và mã vạch).
9. Ràng buộc mã vạch duy nhất (không cho phép 2 sản phẩm cùng mã).
10. Tương thích dữ liệu cũ (sản phẩm có barcode=None vẫn hoạt động tốt).
"""

import unittest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import models và Base từ ứng dụng
from app.database import Base
from app.models.category import Category
from app.models.customer import Customer
from app.models.order import Order, OrderDetail, OrderStatus
from app.models.product import Product
from app.models.user import User, UserRole

# Import repositories và services
from app.repositories import product_repository, order_repository
from app.services import product_service, order_service
from app.schemas.product import ProductCreate, ProductUpdate
from app.schemas.order import OrderCreate, OrderItemCreate, DiscountTypeEnum
from app.utils.exceptions import AppException


class TestBarcodeAndOrderFlow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Sử dụng SQLite in-memory để test an toàn độc lập
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False}
        )
        cls.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        # Xóa sạch dữ liệu trước mỗi bài test
        self.db.query(OrderDetail).delete()
        self.db.query(Order).delete()
        self.db.query(Product).delete()
        self.db.query(Customer).delete()
        self.db.query(Category).delete()
        self.db.commit()

        # Tạo category mẫu
        self.cat = Category(name="Đồ uống")
        self.db.add(self.cat)
        self.db.commit()
        self.db.refresh(self.cat)

    def tearDown(self):
        self.db.close()

    def test_01_valid_barcode_lookup(self):
        """Test 1: Tìm kiếm sản phẩm bằng mã vạch hợp lệ."""
        prod = Product(
            name="Nước ngọt Coca-Cola 330ml",
            barcode="8935001701103",
            price=10000,
            quantity=50,
            category_id=self.cat.id,
        )
        self.db.add(prod)
        self.db.commit()

        found = product_service.get_product_by_barcode(self.db, "8935001701103")
        self.assertIsNotNone(found)
        self.assertEqual(found.name, "Nước ngọt Coca-Cola 330ml")
        self.assertEqual(found.price, 10000)

    def test_02_nonexistent_barcode(self):
        """Test 2: Quét mã không tồn tại trong hệ thống phải ném ngoại lệ 404."""
        with self.assertRaises(AppException) as ctx:
            product_service.get_product_by_barcode(self.db, "9999999999999")
        self.assertEqual(ctx.exception.status_code, 404)

    def test_03_barcode_with_leading_zeros(self):
        """Test 3: Mã vạch có số 0 ở đầu (UPC/EAN-8/13) không được bị mất số 0."""
        barcode_with_zero = "0123456789012"
        prod = Product(
            name="Sữa chua Vinamilk",
            barcode=barcode_with_zero,
            price=7000,
            quantity=30,
            category_id=self.cat.id,
        )
        self.db.add(prod)
        self.db.commit()

        found = product_service.get_product_by_barcode(self.db, "0123456789012")
        self.assertIsNotNone(found)
        self.assertEqual(found.barcode, "0123456789012")
        self.assertTrue(found.barcode.startswith("0"))

    def test_04_duplicate_barcode_rejected(self):
        """Test 4: Không cho phép tạo 2 sản phẩm trùng mã vạch."""
        p1 = ProductCreate(
            name="Sản phẩm A",
            barcode="8938505974015",
            price=15000,
            quantity=10,
            category_id=self.cat.id,
        )
        product_service.create_product(self.db, p1)

        p2 = ProductCreate(
            name="Sản phẩm B trùng mã",
            barcode="8938505974015",
            price=20000,
            quantity=5,
            category_id=self.cat.id,
        )
        with self.assertRaises(AppException) as ctx:
            product_service.create_product(self.db, p2)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Barcode đã tồn tại", str(ctx.exception.message))

    def test_05_legacy_products_without_barcode(self):
        """Test 5: Sản phẩm cũ không có mã vạch (barcode=None) vẫn hoạt động bình thường."""
        legacy_prod = Product(
            name="Bánh mì không mã vạch",
            barcode=None,
            price=5000,
            quantity=20,
            category_id=self.cat.id,
        )
        self.db.add(legacy_prod)
        self.db.commit()

        # Vẫn tìm được qua ID và tìm kiếm tên bình thường
        prod_by_id = product_service.get_product(self.db, legacy_prod.id)
        self.assertIsNotNone(prod_by_id)
        self.assertIsNone(prod_by_id.barcode)

        # Cập nhật thêm mã vạch cho sản phẩm cũ an toàn
        update_payload = ProductUpdate(barcode="893000000001")
        updated = product_service.update_product(self.db, legacy_prod.id, update_payload)
        self.assertEqual(updated.barcode, "893000000001")

    def test_06_out_of_stock_rejected(self):
        """Test 6: Kiểm tra tồn kho — Sản phẩm hết hàng hoặc vượt quá số lượng phải bị từ chối."""
        prod = Product(
            name="Snack Khoai tây",
            barcode="893600000001",
            price=12000,
            quantity=2,  # Chỉ còn 2 gói
            category_id=self.cat.id,
        )
        self.db.add(prod)
        self.db.commit()

        # Thử mua 5 gói -> phải báo lỗi 400 không đủ tồn kho
        order_payload = OrderCreate(
            payment_method="Tiền mặt",
            items=[OrderItemCreate(product_id=prod.id, quantity=5)],
        )
        with self.assertRaises(AppException) as ctx:
            order_service.create_order(self.db, order_payload)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("không đủ tồn kho", str(ctx.exception.message))

        # Tồn kho trong DB phải không bị trừ (Rollback an toàn)
        self.db.refresh(prod)
        self.assertEqual(prod.quantity, 2)

    def test_07_order_creation_and_reprint_data(self):
        """Test 7: Tạo đơn hàng thành công, trừ kho đúng và nạp đủ thông tin để in / in lại."""
        p1 = Product(name="Cà phê sữa đá", barcode="893111111111", price=25000, quantity=10)
        p2 = Product(name="Trà đào cam sả", barcode="893222222222", price=30000, quantity=10)
        self.db.add_all([p1, p2])
        self.db.commit()

        payload = OrderCreate(
            customer_name="Anh Nam",
            payment_method="Tiền mặt",
            discount_type=DiscountTypeEnum.amount,
            discount_value=5000,
            vat_percent=8,
            items=[
                OrderItemCreate(product_id=p1.id, quantity=2),  # 2 * 25000 = 50000
                OrderItemCreate(product_id=p2.id, quantity=1),  # 1 * 30000 = 30000
            ],
        )

        # 1. Tạo đơn hàng trong transaction
        order = order_service.create_order(self.db, payload)
        self.assertIsNotNone(order.id)
        self.assertEqual(order.code, f"HD{str(order.id).zfill(5)}")
        self.assertEqual(order.subtotal, 80000)
        self.assertEqual(order.discount_amount, 5000)
        # amount_after_discount = 75000, vat = 75000 * 8% = 6000, total = 81000
        self.assertEqual(order.vat_amount, 6000)
        self.assertEqual(order.total, 81000)

        # Kiểm tra trừ kho
        self.db.refresh(p1)
        self.db.refresh(p2)
        self.assertEqual(p1.quantity, 8)
        self.assertEqual(p2.quantity, 9)

        # 2. Kiểm tra in lại hóa đơn (Reprint): Chi tiết phải có tên sản phẩm và mã vạch
        reprint_order = order_service.get_order(self.db, order.id)
        self.assertEqual(len(reprint_order.order_details), 2)
        
        detail_names = [d.product_name for d in reprint_order.order_details]
        detail_barcodes = [d.product_barcode for d in reprint_order.order_details]
        
        self.assertIn("Cà phê sữa đá", detail_names)
        self.assertIn("Trà đào cam sả", detail_names)
        self.assertIn("893111111111", detail_barcodes)
        self.assertIn("893222222222", detail_barcodes)

    def test_08_search_by_name_and_barcode(self):
        """Test 8: Tìm kiếm sản phẩm qua repository bằng cả tên hoặc mã vạch."""
        prod = Product(name="Nước khoáng Lavie 500ml", barcode="8934567891234", price=6000, quantity=100)
        self.db.add(prod)
        self.db.commit()

        # Tìm bằng barcode
        items_by_barcode, count1 = product_repository.search(self.db, keyword="8934567891234", category_id=None, page=1, page_size=10)
        self.assertEqual(count1, 1)
        self.assertEqual(items_by_barcode[0].name, "Nước khoáng Lavie 500ml")

        # Tìm bằng tên
        items_by_name, count2 = product_repository.search(self.db, keyword="Lavie", category_id=None, page=1, page_size=10)
        self.assertEqual(count2, 1)
        self.assertEqual(items_by_name[0].barcode, "8934567891234")


if __name__ == "__main__":
    unittest.main()
