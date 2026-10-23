@echo off
title Bear Charged POS - Print Agent
color 0A

echo ===================================================================
echo             BEAR CHARGED POS — LOCAL PRINT AGENT
echo       Dich vu may in hoa don nhiet & may quet ma vach POS
echo ===================================================================
echo.

REM Kiem tra Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Python tren he thong!
    echo Vui long cai dat Python 3 tu python.org va tich chon "Add Python to PATH".
    pause
    exit /b 1
)

echo [*] Dang khoi dong Print Agent tai http://127.0.0.1:18080 ...
echo [*] Nhan Ctrl + C de dung dich vu.
echo.

cd /d "%~dp0"
python print_agent.py

pause
