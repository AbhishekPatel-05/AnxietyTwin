import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AnxietyTwin"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "anxietytwin-super-secure-production-secret-key-32chars-min!")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database connection string (PostgreSQL default, configurable via .env)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/anxietytwin"
    )
    
    # ML models directory
    ML_MODELS_DIR: str = os.getenv("ML_MODELS_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ml/models")))
    
    # CORS Origins
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore"
    )


settings = Settings()

