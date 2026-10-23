# HƯỚNG DẪN TÍCH HỢP MÁY QUÉT MÃ VẠCH VÀ MÁY IN NHIỆT — BEAR POS

Tài liệu này hướng dẫn chi tiết cách kết nối, kiểm tra và vận hành máy quét mã vạch ZEBEX và máy in hóa đơn nhiệt với hệ thống Bear Charged POS.

---

## 1. MÁY QUÉT MÃ VẠCH ZEBEX (Z-3100 Handheld CCD Scanner)

### Cách thức hoạt động
- Máy quét mã vạch ZEBEX Z-3100 kết nối với máy tính qua cổng USB và hoạt động ở chế độ **USB HID Keyboard Emulation** (mô phỏng bàn phím).
- Khi quét mã vạch, máy quét sẽ "gõ" chuỗi ký tự mã vạch với tốc độ siêu nhanh và tự động gửi phím **Enter** kết thúc.
- Hệ điều hành Windows tự nhận diện như một bàn phím phụ mà **không cần cài thêm driver**.

### Cách kiểm tra hoạt động
1. Cắm đầu dây USB của máy quét ZEBEX vào cổng USB máy tính.
2. Đèn LED trên lưng máy quét sáng lên.
3. Mở Notepad (hoặc mở màn hình bán hàng `order.html`).
4. Hướng đầu quét vào một mã vạch bất kỳ (vỏ bánh, chai nước, v.v.) và bóp cò/quét.
5. Nếu dãy số xuất hiện kèm xuống dòng: Máy quét hoạt động hoàn hảo.
6. Trên màn hình bán hàng Bear POS:
   - Hệ thống tự động thêm sản phẩm vào giỏ hàng.
   - Nếu quét cùng mã nhiều lần: số lượng tự động tăng lên 1 (kiểm tra tồn kho).
   - Có âm thanh tiếng "bíp" POS phản hồi trực quan.
   - Bấm phím **F2** bất kỳ lúc nào để đưa con trỏ về ô quét mã vạch.

---

## 2. MÁY IN HÓA ĐƠN NHIỆT (Thermal Receipt Printer)

### A. Cách xác định Model và Thông số (In Self-Test Page)
Để biết chính xác model, khổ giấy và tốc độ baudrate:
1. **Tắt nguồn** máy in nhiệt (công tắc POWER về OFF).
2. **Nhấn và GIỮ nút FEED** (đẩy giấy) trên mặt máy in.
3. **Bật công tắc nguồn** (ON) trong khi **VẪN GIỮ** nút FEED.
4. Đợi 2-3 giây khi máy in kêu tiếng "bíp" hoặc bắt đầu kéo giấy thì nhả nút FEED.
5. Máy in sẽ tự động in ra 1 tờ giấy dài chứa:
   - **Tên hãng và Model** (VD: Xprinter XP-80C, XP-Q800, Rongta RP80, TM-T82,...).
   - **Cổng kết nối**: USB, Serial (COM), hoặc Ethernet (LAN IP).
   - **Khổ giấy**: 80mm (Font A: 48 ký tự/dòng, Font B: 42) hoặc 58mm (Font A: 32 ký tự).
   - **Baudrate** (nếu cắm cổng COM): thường là 9600 hoặc 19200 bps.

### B. Giải mã bảng công tắc DIP-8 ở mặt sau máy in
- **SW-1 (Cutter)**: Bật/tắt dao cắt tự động. Gạt ON để bật tự động cắt giấy khi in xong.
- **SW-2 (Beeper)**: Còi báo. Gạt ON để máy phát tiếng bíp khi in xong.
- **SW-3 (Print Density)**: Độ đậm mực in nhiệt (ON = Đậm, OFF = Vừa).
- **SW-4**: Bộ ký tự tiếng Việt hoặc ký tự 2-byte (tùy model).
- **SW-5 (Char/Line)**: Số ký tự mỗi dòng (ON = 42/36 ký tự, OFF = 48/32 ký tự).
- **SW-6 (Feed with Cut)**: Đẩy giấy trước khi cắt. Gạt ON để không bị cắt phạm vào nội dung hóa đơn.
- **SW-7 & SW-8 (Baud rate cổng COM)**:
  - SW-7 OFF, SW-8 OFF: 9600 bps (mặc định phổ thông).
  - SW-7 ON,  SW-8 OFF: 19200 bps.
  - SW-7 OFF, SW-8 ON:  38400 bps.
  - SW-7 ON,  SW-8 ON:  115200 bps.

---

## 3. CHẠY BEAR POS PRINT AGENT TRÊN WINDOWS

Print Agent là dịch vụ cục bộ kết nối giữa trình duyệt POS và máy in nhiệt tại quầy.

### Bước 1: Khởi động Print Agent
- Nhấp đúp vào file `start_agent.bat` trong thư mục `print_agent/`.
- Màn hình console hiển thị: `Dang khoi chay tai: http://127.0.0.1:18080`.
- Print Agent tự động nhận diện máy in nhiệt trên Windows.

### Bước 2: Bán hàng và In hóa đơn
1. Mở màn hình bán hàng `order.html`.
2. Trên góc màn hình, trạng thái máy in sẽ hiển thị badge màu xanh lá: `Máy in: Sẵn sàng (ESC/POS)`.
3. Quét mã sản phẩm bằng máy ZEBEX -> Nhấn Thanh toán -> Chọn Tiền mặt hoặc QR -> Xác nhận.
4. Lệnh in được gửi thẳng đến máy in nhiệt:
   - Tên cửa hàng in to đậm giữa trang.
   - Bảng sản phẩm căn lề chuẩn xác.
   - Tự động cắt giấy khi in xong.
5. **Nút in lại (Reprint)**:
   - Trong modal hóa đơn có nút **🔄 In lại**.
   - Trên thanh công cụ có nút **In lại đơn vừa tạo** giúp in lại bất kỳ lúc nào nếu vừa hết giấy.

### Bước 3: Chế độ dự phòng (Fallback)
- Nếu Print Agent chưa mở hoặc gặp sự cố:
  - Hệ thống tự động chuyển sang **In qua trình duyệt** (HTML/CSS).
  - Mẫu in đã được CSS tối ưu chuẩn xác cho khổ giấy nhiệt 80mm/58mm, ẩn toàn bộ giao diện web thừa.
