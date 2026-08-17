# POS Backend (FastAPI + MySQL)
## 1. Cài đặt

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Cấu hình

```bash
cp .env.example .env
```

Sửa `.env`, điền đúng thông tin MySQL của bạn (`DATABASE_URL`) và một
`SECRET_KEY` ngẫu nhiên (dùng cho JWT).

Nhớ tạo database trước:

```sql
CREATE DATABASE pos_db CHARACTER SET utf8mb4;
```

## 3. Khởi tạo bảng (chọn 1 trong 2 cách)

Cách nhanh (không quản lý version, phù hợp lúc dev):

```bash
python -c "from app.database import Base, engine; import app.models; Base.metadata.create_all(bind=engine)"
```

Cách chuẩn (dùng Alembic, khuyến nghị khi đã lên production):

```bash
alembic revision --autogenerate -m "init tables"
alembic upgrade head
```

## 4. Chạy server
```bash
uvicorn app.main:app --reload
```

Swagger UI: http://127.0.0.1:8000/docs
