"""
Alembic env.py — được customize để:
1. Lấy DATABASE_URL từ app/config.py (đọc .env) thay vì hard-code trong alembic.ini.
2. Trỏ target_metadata vào Base.metadata của project để hỗ trợ autogenerate.
"""

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Cho phép import "app.xxx" khi chạy alembic từ thư mục gốc project
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.database import Base  # noqa: E402
import app.models  # noqa: E402  (import để đăng ký hết model vào Base.metadata)

config = context.config

# Ghi đè sqlalchemy.url trong alembic.ini bằng giá trị thật từ .env
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Sinh SQL migration mà không cần kết nối DB thật (dùng `alembic upgrade --sql`)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Chạy migration với kết nối DB thật (chế độ thông thường)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
