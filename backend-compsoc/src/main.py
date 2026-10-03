import logging

from fastapi import FastAPI
from pydantic_settings import BaseSettings, SettingsConfigDict
from schema import RequestOut

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
app = FastAPI()


@app.get("/api/", status_code=204, operation_id="getAllPoints")
async def get_all_points(locations: RequestOut):
    pass
