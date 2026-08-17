"""
Cấu hình ứng dụng — đọc từ biến môi trường / file .env bằng pydantic-settings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ---- Database ----
    DATABASE_URL: str = "mysql+pymysql://root:12345678@localhost:3306/pos_db"

    # ---- JWT ----
    SECRET_KEY: str = "change-this-to-a-random-secret-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ---- CORS ----
    CORS_ORIGINS: str = "http://127.0.0.1:5500,http://localhost:5500"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        """Chuyển chuỗi "a,b,c" trong .env thành list để CORSMiddleware dùng được."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
