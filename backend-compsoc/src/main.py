import logging

from fastapi import FastAPI, HTTPException
from pydantic_settings import BaseSettings, SettingsConfigDict
from schema import *

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
app = FastAPI()


@app.get(
    "/api/get_all_points",
    operation_id="getAllPoints",
    response_model=list[GlobePoint],
)
async def get_all_points():
    # TODO: past wildfires from real-world data.
    return []


@app.post(
    "/api/request_anomaly",
    operation_id="requestAnomaly",
    response_model=Anomaly,
)
async def request_anomaly(request: RequestAnomaly):
    # TODO: the anomaly query about one point.
    raise HTTPException(status_code=501, detail="Anomaly queries are not set up yet")
