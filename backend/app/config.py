from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://crudemap:crudemap@localhost:5432/crudemap"
    etl_loader: str = "json"

    # Sync URL used only by Alembic and seed scripts
    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("+asyncpg", "")

    class Config:
        env_file = ".env"


settings = Settings()
