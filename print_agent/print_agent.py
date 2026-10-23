"""
BEAR CHARGED POS — LOCAL PRINT AGENT (Dành cho máy in hóa đơn nhiệt)
=====================================================================
Chạy dịch vụ cục bộ tại máy quầy thu ngân (Windows):
- Lắng nghe yêu cầu in từ trình duyệt POS (qua 127.0.0.1:18080).
- Bảo vệ an toàn: Chỉ bind localhost, CORS giới hạn nghiêm ngặt.
- Sinh tập lệnh ESC/POS chuẩn cho máy in nhiệt (khổ 80mm / 58mm).
- Hỗ trợ in qua: Windows Printer Spooler, Cổng COM (Serial), hoặc Chế độ Mô phỏng (Virtual Log).
- Cắt giấy tự động (Auto-cut), mở két tiền (Cash drawer).
"""

import os
import sys
import json
import time
import subprocess
from datetime import datetime
from typing import Optional, List, Dict, Any

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
LOG_DIR = os.path.join(os.path.dirname(__file__), "receipts_log")
os.makedirs(LOG_DIR, exist_ok=True)

def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "api_port": 18080,
        "api_host": "127.0.0.1",
        "allowed_origins": [
            "https://bear-charged.onrender.com",
            "http://127.0.0.1:5500",
            "http://localhost:5500",
            "http://127.0.0.1:8000",
            "http://localhost:8000",
            "null",
        ],
        "connection_type": "windows_spooler",
        "printer_name": "auto",
        "paper_width_mm": 80,
        "chars_per_line": 48,
        "auto_cut": True,
        "enable_beeper": True,
        "open_cash_drawer": False,
        "save_receipt_log": True,
    }

config = load_config()

app = FastAPI(title="Bear POS Print Agent", version="1.0.0")

# Cấu hình CORS bảo mật
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.get("allowed_origins", ["*"]),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ---- MODEL DỮ LIỆU HÓA ĐƠN ----
class OrderItemPrint(BaseModel):
    product_id: Optional[int] = None
    name: str
    barcode: Optional[str] = None
    quantity: int
    price: float
    subtotal: float

class OrderPrintPayload(BaseModel):
    order_id: Optional[int] = None
    code: str
    created_at: Optional[str] = None
    customer_fullname: Optional[str] = "Khách lẻ"
    payment_method: Optional[str] = "Tiền mặt"
    subtotal: float
    discount_amount: float = 0
    vat_amount: float = 0
    total: float
    customer_paid: float = 0
    change_amount: float = 0
    is_reprint: bool = False
    items: List[OrderItemPrint] = []


# ---- TIỆN ÍCH XỬ LÝ TEXT VÀ LỆNH ESC/POS ----

def remove_accents(input_str: str) -> str:
    """Loại bỏ dấu tiếng Việt để tương thích tốt nhất với bộ font ROM của máy in nhiệt."""
    if not input_str:
        return ""
    s1 = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ"
    s2 = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd"
    s1_cap = "ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ"
    s2_cap = "AAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD"
    table = str.maketrans(s1 + s1_cap, s2 + s2_cap)
    return input_str.translate(table)

def format_currency_vnd(amount: float) -> str:
    return f"{int(round(amount)):,}d".replace(",", ".")

def generate_esc_pos_receipt(data: OrderPrintPayload, chars_per_line: int = 48) -> bytes:
    """
    Sinh chuỗi byte ESC/POS tiêu chuẩn:
    - ESC @: Khởi tạo máy in
    - ESC a: Căn lề (0: Trái, 1: Giữa, 2: Phải)
    - ESC !: Chọn kiểu font (đậm, to x2)
    - GS V: Cắt giấy
    - ESC p: Mở két tiền
    """
    cmd = bytearray()

    # 1. Khởi tạo máy in (ESC @)
    cmd.extend(b"\x1b\x40")

    # Mở ngăn kéo nếu cấu hình (ESC p m t1 t2)
    if config.get("open_cash_drawer", False):
        cmd.extend(b"\x1b\x70\x00\x19\xfa")

    # 2. Tiêu đề cửa hàng (Căn giữa - Chữ to x2 đậm)
    cmd.extend(b"\x1b\x61\x01")  # Căn giữa
    cmd.extend(b"\x1b\x21\x30")  # Chữ to gấp đôi + đậm
    cmd.extend("BEAR POS\n".encode("ascii", "ignore"))

    cmd.extend(b"\x1b\x21\x00")  # Chữ bình thường
    cmd.extend("CUA HANG TIEN LOI GAU CON\n".encode("ascii", "ignore"))
    cmd.extend("123 Duong ABC, Quan XYZ, TP. Ha Noi\n".encode("ascii", "ignore"))
    cmd.extend("Hotline: 1900 1234\n".encode("ascii", "ignore"))

    # Dấu hiệu in lại (nếu có)
    if data.is_reprint:
        cmd.extend(b"\x1b\x21\x08")  # Đậm
        cmd.extend("*** BAN IN LAI (COPY) ***\n".encode("ascii", "ignore"))
        cmd.extend(b"\x1b\x21\x00")

    # Đường kẻ phân cách
    divider = ("-" * chars_per_line) + "\n"
    cmd.extend(divider.encode("ascii"))

    # 3. Thông tin đơn hàng (Căn trái)
    cmd.extend(b"\x1b\x61\x00")  # Căn trái
    cmd.extend(f"Ma HD:    {data.code}\n".encode("ascii", "ignore"))
    
    dt_str = data.created_at or datetime.now().strftime("%H:%M:%S %d/%m/%Y")
    cmd.extend(f"Ngay gio: {dt_str}\n".encode("ascii", "ignore"))
    cmd.extend(f"Khach:    {remove_accents(data.customer_fullname or 'Khach le')}\n".encode("ascii", "ignore"))
    cmd.extend(f"Thu ngan: Nhan vien ban hang\n".encode("ascii", "ignore"))
    cmd.extend(divider.encode("ascii"))

    # 4. Tiêu đề bảng hàng
    # Bố cục cho khổ 48 ký tự: Tên hàng (22 ký tự) | SL (4) | Đơn giá (10) | Thành tiền (12)
    # Bố cục cho khổ 32 ký tự: Tên hàng (14) | SL (3) | Đơn giá (7) | Thành tiền (8)
    if chars_per_line >= 40:
        header = f"{'Ten san pham':<22}{'SL':>4}{'Don gia':>11}{'Thanh tien':>11}\n"
    else:
        header = f"{'Ten SP':<14}{'SL':>3}{'Gia':>7}{'T.Tien':>8}\n"
    cmd.extend(header.encode("ascii"))
    cmd.extend(divider.encode("ascii"))

    # 5. Chi tiết từng sản phẩm
    for item in data.items:
        clean_name = remove_accents(item.name)
        qty_str = str(item.quantity)
        price_str = format_currency_vnd(item.price)
        sub_str = format_currency_vnd(item.subtotal)

        if chars_per_line >= 40:
            if len(clean_name) > 22:
                name_line1 = clean_name[:22]
                name_line2 = clean_name[22:44]
                cmd.extend(f"{name_line1:<22}{qty_str:>4}{price_str:>11}{sub_str:>11}\n".encode("ascii", "ignore"))
                cmd.extend(f"  {name_line2}\n".encode("ascii", "ignore"))
            else:
                cmd.extend(f"{clean_name:<22}{qty_str:>4}{price_str:>11}{sub_str:>11}\n".encode("ascii", "ignore"))
        else:
            if len(clean_name) > 14:
                name_line1 = clean_name[:14]
                name_line2 = clean_name[14:28]
                cmd.extend(f"{name_line1:<14}{qty_str:>3}{price_str:>7}{sub_str:>8}\n".encode("ascii", "ignore"))
                cmd.extend(f"  {name_line2}\n".encode("ascii", "ignore"))
            else:
                cmd.extend(f"{clean_name:<14}{qty_str:>3}{price_str:>7}{sub_str:>8}\n".encode("ascii", "ignore"))

    cmd.extend(divider.encode("ascii"))

    # 6. Phần tổng cộng
    def line_total(label: str, val: str, is_bold: bool = False):
        gap = chars_per_line - len(label) - len(val)
        gap = max(gap, 1)
        line = f"{label}{' ' * gap}{val}\n"
        if is_bold:
            return b"\x1b\x21\x08" + line.encode("ascii") + b"\x1b\x21\x00"
        return line.encode("ascii")

    cmd.extend(line_total("Tam tinh:", format_currency_vnd(data.subtotal)))
    if data.discount_amount > 0:
        cmd.extend(line_total("Giam gia:", f"-{format_currency_vnd(data.discount_amount)}"))
    if data.vat_amount > 0:
        cmd.extend(line_total("Thue VAT:", format_currency_vnd(data.vat_amount)))

    cmd.extend(divider.encode("ascii"))
    # Tổng thanh toán in to đậm
    cmd.extend(b"\x1b\x21\x30")  # Chữ to x2 đậm
    total_label = "TONG:"
    total_val = format_currency_vnd(data.total)
    gap = (chars_per_line // 2) - len(total_label) - len(total_val)
    gap = max(gap, 1)
    cmd.extend(f"{total_label}{' ' * gap}{total_val}\n".encode("ascii"))
    cmd.extend(b"\x1b\x21\x00")  # Trở về chữ thường

    cmd.extend(line_total("Hinh thuc TT:", remove_accents(data.payment_method or "Tien mat")))
    if data.customer_paid > 0:
        cmd.extend(line_total("Khach dua:", format_currency_vnd(data.customer_paid)))
        cmd.extend(line_total("Tien thua:", format_currency_vnd(data.change_amount)))

    cmd.extend(divider.encode("ascii"))

    # 7. Lời cảm ơn & Chân trang
    cmd.extend(b"\x1b\x61\x01")  # Căn giữa
    cmd.extend("Xin cam on Quy khach & Hen gap lai!\n".encode("ascii", "ignore"))
    cmd.extend("Powered by Bear Charged POS\n\n\n\n".encode("ascii", "ignore"))

    # 8. Còi báo (BEL 0x07)
    if config.get("enable_beeper", True):
        cmd.extend(b"\x07")

    # 9. Lệnh cắt giấy tự động (GS V 66 0)
    if config.get("auto_cut", True):
        cmd.extend(b"\x1d\x56\x42\x00")

    return bytes(cmd)


# ---- CƠ CHẾ GỬI LỆNH ĐẾN MÁY IN THỰC TẾ ----

_cached_printers = []
_last_printer_check = 0

def get_installed_windows_printers() -> List[str]:
    """Lấy danh sách máy in từ Windows qua PowerShell (có cache 30s để tăng tốc độ phản hồi)."""
    global _cached_printers, _last_printer_check
    now = time.time()
    if _cached_printers and (now - _last_printer_check < 30):
        return _cached_printers

    try:
        cmd = 'powershell -NoProfile -NonInteractive -Command "Get-Printer | Select-Object -ExpandProperty Name"'
        out = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=3)
        if out.returncode == 0:
            printers = [line.strip() for line in out.stdout.split("\n") if line.strip()]
            _cached_printers = printers
            _last_printer_check = now
            return printers
    except Exception as e:
        print(f"[!] Lỗi đọc danh sách máy in: {e}")
    return _cached_printers

def select_best_printer(installed_printers: List[str]) -> Optional[str]:
    """Tìm máy in nhiệt phù hợp nhất từ danh sách."""
    configured_name = config.get("printer_name", "auto")
    if configured_name and configured_name != "auto" and configured_name in installed_printers:
        return configured_name

    # Tìm máy in có từ khóa máy in nhiệt POS
    keywords = ["pos", "receipt", "thermal", "xp-", "xprinter", "rongta", "zywell", "epson", "80c", "58"]
    for p in installed_printers:
        for kw in keywords:
            if kw in p.lower():
                return p

    # Fallback nếu có máy in thông thường
    for p in installed_printers:
        if "pdf" not in p.lower() and "onenote" not in p.lower():
            return p

    return installed_printers[0] if installed_printers else None

def send_to_windows_printer(printer_name: str, raw_data: bytes) -> bool:
    """
    Gửi dữ liệu raw bytes tới máy in Windows:
    1. Thử dùng win32print (nếu cài đặt pywin32)
    2. Fallback qua tạm file và gửi lệnh PowerShell Out-Printer / print
    """
    # 1. Thử win32print
    try:
        import win32print
        hPrinter = win32print.OpenPrinter(printer_name)
        try:
            hJob = win32print.StartDocPrinter(hPrinter, 1, ("Bear_POS_Receipt", None, "RAW"))
            try:
                win32print.StartPagePrinter(hPrinter)
                win32print.WritePrinter(hPrinter, raw_data)
                win32print.EndPagePrinter(hPrinter)
            finally:
                win32print.EndDocPrinter(hPrinter)
        finally:
            win32print.ClosePrinter(hPrinter)
        return True
    except ImportError:
        pass
    except Exception as e:
        print(f"[!] Lỗi khi in qua win32print: {e}")

    # 2. Fallback: Ghi file tạm và gửi qua command line Windows
    temp_file = os.path.join(LOG_DIR, "temp_print_job.bin")
    try:
        with open(temp_file, "wb") as f:
            f.write(raw_data)
        
        # Thử gửi raw file tới máy in bằng PowerShell
        ps_cmd = f'powershell -Command "Get-Content -Path \'{temp_file}\' -Encoding Byte -Raw | Out-Printer -Name \'{printer_name}\'"'
        res = subprocess.run(ps_cmd, shell=True, capture_output=True)
        if res.returncode == 0:
            return True
    except Exception as e:
        print(f"[!] Lỗi in qua PowerShell fallback: {e}")

    return False

def send_to_serial_port(port_name: str, baudrate: int, raw_data: bytes) -> bool:
    """Gửi dữ liệu trực tiếp qua cổng COM / Serial (RS-232)."""
    try:
        import serial
        with serial.Serial(port_name, baudrate, timeout=3) as ser:
            ser.write(raw_data)
            ser.flush()
        return True
    except Exception as e:
        print(f"[!] Lỗi gửi qua cổng Serial {port_name}: {e}")
        return False


# ---- API ENDPOINTS ----

@app.get("/status")
def get_status():
    """Kiểm tra trạng thái Agent và máy in hiện có."""
    printers = get_installed_windows_printers()
    selected_printer = select_best_printer(printers)
    return {
        "status": "online",
        "agent": "Bear POS Print Agent v1.0",
        "timestamp": datetime.now().isoformat(),
        "printer_name": selected_printer or "Chưa cấu hình máy in",
        "connection_type": config.get("connection_type", "windows_spooler"),
        "installed_printers": printers,
        "config": {
            "paper_width_mm": config.get("paper_width_mm", 80),
            "chars_per_line": config.get("chars_per_line", 48),
            "auto_cut": config.get("auto_cut", True),
        },
    }

@app.get("/printers")
def list_printers():
    """Lấy danh sách tất cả máy in đang cài đặt trên máy tính Windows."""
    printers = get_installed_windows_printers()
    selected = select_best_printer(printers)
    return {
        "printers": printers,
        "selected_printer": selected,
    }

@app.post("/test")
def print_test_page():
    """In trang kiểm tra kết nối máy in nhiệt."""
    test_item = OrderItemPrint(
        name="San pham thu nghiem POS",
        quantity=1,
        price=50000,
        subtotal=50000
    )
    test_payload = OrderPrintPayload(
        code="TEST-0001",
        customer_fullname="Kiem tra he thong",
        payment_method="TEST",
        subtotal=50000,
        total=50000,
        is_reprint=False,
        items=[test_item]
    )
    return do_print_order(test_payload)

@app.post("/print")
def print_order(payload: OrderPrintPayload):
    """Nhận dữ liệu từ POS Frontend và thực hiện in ra máy in nhiệt."""
    return do_print_order(payload)

def do_print_order(payload: OrderPrintPayload):
    chars_per_line = config.get("chars_per_line", 48)
    raw_esc_pos = generate_esc_pos_receipt(payload, chars_per_line=chars_per_line)

    # Lưu log hóa đơn (phục vụ đối soát và mô phỏng)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f"receipt_{payload.code}_{timestamp}.txt"
    log_path = os.path.join(LOG_DIR, log_filename)
    try:
        with open(log_path, "wb") as f:
            f.write(raw_esc_pos)
    except Exception:
        pass

    conn_type = config.get("connection_type", "windows_spooler")
    success = False

    if conn_type == "serial_com":
        port = config.get("serial_port", "COM1")
        baud = config.get("serial_baudrate", 9600)
        success = send_to_serial_port(port, baud, raw_esc_pos)
    else:
        # Mặc định: in qua Windows Spooler
        printers = get_installed_windows_printers()
        printer_name = select_best_printer(printers)

        if printer_name:
            success = send_to_windows_printer(printer_name, raw_esc_pos)
        else:
            success = False

    if success:
        return {
            "success": True,
            "message": f"In hóa đơn {payload.code} thành công!",
            "log_file": log_filename,
        }
    else:
        # Nếu chưa có máy in vật lý, vẫn lưu log thành công để người dùng kiểm tra mô phỏng
        return {
            "success": True,
            "simulated": True,
            "message": f"Đã lưu bản in mô phỏng (chưa tìm thấy máy in nhiệt vật lý được kết nối). Xem tại: receipts_log/{log_filename}",
            "log_file": log_filename,
        }

if __name__ == "__main__":
    host = config.get("api_host", "127.0.0.1")
    port = config.get("api_port", 18080)
    print("\n" + "=" * 65)
    print(f"  BEAR CHARGED POS — LOCAL PRINT AGENT")
    print(f"  Dang khoi chay tai: http://{host}:{port}")
    print(f"  Tu dong ket noi may in nhiet & giu an toan cho quay ban hang")
    print("=" * 65 + "\n")
    uvicorn.run(app, host=host, port=port, log_level="info")
