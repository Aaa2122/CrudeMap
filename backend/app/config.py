from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://crudemap:crudemap@localhost:5432/crudemap"
    etl_loader: str = "json"

    aisstream_api_key: str | None = None
    ais_throttle_seconds: float = 3.0

    # Sync URL used only by Alembic and seed scripts
    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("+asyncpg", "")

    class Config:
        env_file = ".env"


settings = Settings()
