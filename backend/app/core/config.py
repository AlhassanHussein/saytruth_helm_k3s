import os
from pathlib import Path
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[3]
DEFAULT_SQLITE_PATH = BASE_DIR / "database/sqlite/saytruth.db"
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    app_name: str = "SayTruth API"
    api_prefix: str = "/api"
    secret_key: str = "change-this-secret"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = ""
    db_host: str = "localhost"
    db_port: str = "5432"
    db_name: str = "saytruth_db"
    db_user: str = "saytruth_user"
    db_password: str = "DevSecurePass123!@#"
    algorithm: str = "HS256"
    google_client_id: str = ""

    def __init__(self, **data):
        super().__init__(**data)
        # If database_url is not set via env, construct it from components
        if not self.database_url:
            db_user = quote_plus(self.db_user)
            db_password = quote_plus(self.db_password)
            self.database_url = (
                f"postgresql://{db_user}:{db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
            )


def get_settings() -> Settings:
    return Settings()
