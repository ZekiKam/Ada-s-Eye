import logging
from contextlib import asynccontextmanager
from datetime import datetime, time, timezone
from pathlib import Path
from typing import Annotated

from anomalies import (
    Detection,
    Wildfire,
    find_anomalies,
    haversine_km,
    load_detections,
    load_wildfires,
)
from fastapi import FastAPI, Query
from pydantic_settings import BaseSettings, SettingsConfigDict
from schema import *

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    # Folder holding the two CSV files.
    data_dir: Path = Path(__file__).resolve().parent.parent / "data"
    wildfires_file: str = "wildfires.csv"
    detections_file: str = "satellite_detections.csv"
    # A detection at or above this brightness (kelvin) can be an anomaly.
    brightness_threshold: float = 340.0
    # A wildfire explains a detection within its radius plus this distance...
    match_distance_km: float = 10.0
    # ...and within this many days either side.
    match_days: int = 1
    # How far from a queried spot request_anomaly looks for anomalies.
    query_radius_km: float = 50.0


settings = Settings()

wildfires: list[Wildfire] = []
anomalies: list[Detection] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global wildfires, anomalies
    wildfires = load_wildfires(settings.data_dir / settings.wildfires_file)
    detections = load_detections(settings.data_dir / settings.detections_file)
    anomalies = find_anomalies(
        wildfires,
        detections,
        brightness_threshold=settings.brightness_threshold,
        match_distance_km=settings.match_distance_km,
        match_days=settings.match_days,
    )
    logger.info(
        "Loaded %d wildfires and %d detections from %s; %d anomalies",
        len(wildfires),
        len(detections),
        settings.data_dir,
        len(anomalies),
    )
    yield


app = FastAPI(lifespan=lifespan)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


@app.get(
    "/api/get_all_points",
    operation_id="getAllPoints",
    response_model=list[GlobePoint],
)
async def get_all_points():
    return [
        GlobePoint(
            longitude=f.longitude,
            latitude=f.latitude,
            event_time=_iso(datetime.combine(f.day, time(tzinfo=timezone.utc))),
            radius=f.radius_m,
        )
        for f in wildfires
    ]


@app.get(
    "/api/get_anomalies",
    operation_id="getAnomalies",
    response_model=list[DetectedAnomaly],
)
async def get_anomalies():
    return [
        DetectedAnomaly(
            longitude=a.longitude,
            latitude=a.latitude,
            event_time=_iso(a.detected_at),
            brightness=a.brightness,
            confidence=a.confidence,
            radius=a.radius_m,
        )
        for a in anomalies
    ]


@app.get(
    "/api/request_anomaly",
    operation_id="requestAnomaly",
    response_model=Anomaly,
)
async def request_anomaly(request: Annotated[RequestAnomaly, Query()]):
    """Centred on the queried spot: the confidence of the most confident
    anomaly near it in that year, and the radius that reaches it. With none,
    confidence 0 over the whole search radius."""

    def distance_km(a: Detection) -> float:
        return haversine_km(request.longitude, request.latitude, a.longitude, a.latitude)

    nearby = [
        a
        for a in anomalies
        if a.detected_at.year == request.year and distance_km(a) <= settings.query_radius_km
    ]
    if not nearby:
        confidence, radius = 0.0, settings.query_radius_km * 1000
    else:
        best = max(nearby, key=lambda a: (a.confidence, a.brightness))
        confidence, radius = best.confidence, distance_km(best) * 1000 + best.radius_m
    return Anomaly(
        longitude=request.longitude,
        latitude=request.latitude,
        confidence=confidence,
        radius=radius,
    )
