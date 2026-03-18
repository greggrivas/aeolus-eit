from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATA_DIR: Path = Path(__file__).resolve().parents[2] / "data" / "processed"
    MODELS_DIR: Path = Path(__file__).resolve().parents[2] / "models"
    RAW_DATA_DIR: Path = Path(__file__).resolve().parents[2] / "CARE_To_Compare" / "Wind Farm A"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"


settings = Settings()
