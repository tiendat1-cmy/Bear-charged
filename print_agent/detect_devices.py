"""
Script chẩn đoán và phát hiện phần cứng POS:
1. Máy quét mã vạch ZEBEX (USB HID / COM).
2. Máy in hóa đơn nhiệt (Windows Printer Spooler / Serial Ports).
3. Hướng dẫn đọc trang in Self-Test & bảng DIP-8 Switch.
"""

import sys
import subprocess
import os

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def check_windows_printers():
    print("\n" + "=" * 60)
    print(" 1. KIỂM TRA MÁY IN TRÊN WINDOWS (Windows Printers)")
    print("=" * 60)
    try:
        cmd = 'powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, Type"'
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        if result.returncode == 0 and result.stdout.strip():
            print(result.stdout.strip())
            
            lines = result.stdout.strip().split("\n")
            thermal_found = []
            for line in lines:
                lower = line.lower()
                for kw in ["pos", "receipt", "thermal", "xp-", "xprinter", "rongta", "zywell", "epson", "80", "58"]:
                    if kw in lower and line not in thermal_found:
                        thermal_found.append(line.strip())
            
            if thermal_found:
                print("\n[+] Phát hiện máy in nghi là máy in nhiệt POS:")
                for p in thermal_found:
                    print(f"    -> {p}")
            else:
                print("\n[*] Chưa thấy tên máy in nhiệt chuyên dụng trong danh sách Windows Printer.")
                print("    Nếu máy in của bạn cắm qua cổng USB, hãy cài Driver của hãng (Xprinter/Rongta/Generic Text).")
        else:
            print("[!] Không lấy được danh sách máy in.")
    except Exception as e:
        print(f"[!] Lỗi kiểm tra máy in: {e}")

def check_serial_ports():
    print("\n" + "=" * 60)
    print(" 2. KIỂM TRA CỔNG COM / SERIAL (Dành cho máy in nhiệt qua COM)")
    print("=" * 60)
    try:
        cmd = 'powershell -Command "[System.IO.Ports.SerialPort]::getportnames()"'
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        ports = result.stdout.strip().split()
        if ports:
            print(f"[+] Các cổng COM đang có trên máy tính: {', '.join(ports)}")
            print("    Nếu máy in của bạn cắm cáp COM (RS-232), hãy cấu hình cổng này vào file config.json.")
        else:
            print("[*] Không tìm thấy cổng COM nào đang hoạt động.")
            print("    Hầu hết máy in hiện nay dùng cổng cáp USB trực tiếp.")
    except Exception as e:
        print(f"[!] Lỗi kiểm tra cổng COM: {e}")

def check_barcode_scanner():
    print("\n" + "=" * 60)
    print(" 3. THÔNG TIN MÁY QUÉT MÃ VẠCH ZEBEX CCD")
    print("=" * 60)
    print("Thương hiệu: ZEBEX")
    print("Model tiêu biểu: Z-3100 CCD Handheld Barcode Scanner")
    print("Chế độ hoạt động chuẩn: USB HID Keyboard Emulation")
    print("- Khi cắm cáp USB vào máy tính, đèn LED trên máy quét sáng lên.")
    print("- Windows tự động nhận diện như một BÀN PHÍM phụ (không cần cài driver).")
    print("- Mẹo thử nghiệm nhanh:")
    print("  1. Mở Notepad hoặc ô 'QUÉT MÃ VẠCH' trên màn hình POS.")
    print("  2. Bấm nút quét vào mã vạch bất kỳ trên vỏ bánh kẹo/sữa/sách.")
    print("  3. Nếu máy quét 'tít' một tiếng và dãy số xuất hiện kèm xuống dòng -> Máy quét hoạt động hoàn hảo 100%!")

def print_dip_switch_guide():
    print("\n" + "=" * 60)
    print(" 4. HƯỚNG DẪN XÁC ĐỊNH MODEL MÁY IN & BẢNG DIP-8 SWITCH")
    print("=" * 60)
    print("""
CÁCH IN TRANG TỰ KIỂM TRA (SELF-TEST PAGE):
------------------------------------------------------------------
1. Tắt công tắc nguồn máy in nhiệt (OFF).
2. Nhấn và GIỮ nút FEED (đẩy giấy) trên mặt máy in.
3. Bật công tắc nguồn (ON) trong khi VẪN ĐANG GIỮ nút FEED.
4. Đợi 2-3 giây đến khi máy in kêu tiếng 'bíp' hoặc bắt đầu kéo giấy thì nhả tay.
5. Máy in sẽ in ra 1 tờ giấy dài chứa thông số:
   - Tên model chính xác (VD: XP-80C, RP80, TM-T82,...)
   - Cổng kết nối (USB, Serial, Ethernet LAN)
   - Khổ giấy: 80mm (Font 48/42 ký tự) hoặc 58mm (Font 32/36 ký tự)
   - Tốc độ truyền Baudrate (nếu dùng cổng COM: 9600 hoặc 19200)

Ý NGHĨA BẢNG CÔNG TẮC DIP-8 (Ở MẶT SAU HOẶC ĐÁY MÁY IN):
------------------------------------------------------------------
- SW-1: Dao cắt giấy (Auto-cutter): ON = Bật dao cắt | OFF = Tắt
- SW-2: Còi báo (Buzzer/Beeper):    ON = Kêu bíp khi in | OFF = Tắt còi
- SW-3: Độ đậm nét (Print density): ON = Đậm nét | OFF = Tiêu chuẩn
- SW-4: Bộ ký tự / Tiếng Việt:     Tùy model máy
- SW-5: Số ký tự mỗi dòng:          ON = 42/36 ký tự | OFF = 48/32 ký tự
- SW-6: Kéo giấy trước khi cắt:     ON = Kéo thêm giấy | OFF = Cắt ngay
- SW-7 & SW-8: Tốc độ cổng COM (Baudrate):
       SW-7 OFF, SW-8 OFF: 9600 bps (mặc định phổ biến)
       SW-7 ON,  SW-8 OFF: 19200 bps
       SW-7 OFF, SW-8 ON:  38400 bps
       SW-7 ON,  SW-8 ON:  115200 bps
""")

if __name__ == "__main__":
    print("\n" + "#" * 60)
    print("     BEAR POS — CÔNG CỤ CHẨN ĐOÁN THIẾT BỊ BÁN HÀNG")
    print("#" * 60)
    check_windows_printers()
    check_serial_ports()
    check_barcode_scanner()
    print_dip_switch_guide()
    print("\n" + "=" * 60)
    print(" Chẩn đoán hoàn tất. Nhấn Enter để thoát.")
    print("=" * 60)
