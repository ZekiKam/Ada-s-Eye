import logging
from contextlib import asynccontextmanager
from datetime import datetime, time, timezone
from pathlib import Path
from typing import Annotated

from anomalies import FoundAnomaly, find_anomaly
from datasets import (
    Detection,
    Wildfire,
    haversine_km,
    load_detections,
    load_wildfires,
)
from dryness import Dryness, load_dryness
from fastapi import FastAPI, HTTPException, Query
from leaderboard import AlreadyNamed, Entry, Forbidden, Leaderboard, NotFound
from pydantic_settings import BaseSettings, SettingsConfigDict
from schema import *

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    # Folder holding the two CSV files and the climate grid.
    data_dir: Path = Path(__file__).resolve().parent.parent / "data"
    wildfires_file: str = "wildfires.csv"
    detections_file: str = "satellite_detections.csv"
    climate_file: str = "real/koeppen_geiger.txt.gz"
    # How far from a queried spot request_anomaly looks for an anomaly.
    query_radius_km: float = 250.0


settings = Settings()

wildfires: list[Wildfire] = []
detections: list[Detection] = []
dryness = Dryness({})
leaderboard = Leaderboard()
# Every anomaly found so far, oldest find first. In memory only.
found_anomalies: list[FoundAnomaly] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global wildfires, detections, dryness
    wildfires = load_wildfires(settings.data_dir / settings.wildfires_file)
    detections = load_detections(settings.data_dir / settings.detections_file)
    dryness = load_dryness(settings.data_dir / settings.climate_file)
    logger.info(
        "Loaded %d wildfires and %d detections from %s",
        len(wildfires),
        len(detections),
        settings.data_dir,
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
    "/api/request_anomaly",
    operation_id="requestAnomaly",
    response_model=Anomaly,
)
async def request_anomaly(request: Annotated[RequestAnomaly, Query()]):
    """The anomaly within the search radius of the queried spot in that year,
    found on the fly: its middle, radius, intensity and distance. With none,
    the queried spot and the search radius at confidence 0. An anomaly found
    for the first time that is among the largest goes on the leaderboard, and
    `claim` holds the token to name it. Each anomaly can be found only once:
    after that, queries skip it."""
    found = find_anomaly(
        request.longitude,
        request.latitude,
        request.year,
        search_km=settings.query_radius_km,
        fires=wildfires,
        detections=detections,
        dryness=dryness,
        found=found_anomalies,
    )
    if found is None:
        return Anomaly(
            longitude=request.longitude,
            latitude=request.latitude,
            confidence=0.0,
            intensity=0.0,
            radius=settings.query_radius_km * 1000,
            distance=0.0,
        )
    found_anomalies.append(found)
    claim = None
    if entry := leaderboard.submit(found):
        claim = LeaderboardClaim(
            id=entry.id, rank=leaderboard.rank(entry), token=entry.token
        )
    return Anomaly(
        longitude=found.longitude,
        latitude=found.latitude,
        confidence=found.confidence,
        intensity=found.intensity,
        radius=found.radius_km * 1000,
        distance=haversine_km(
            request.longitude, request.latitude, found.longitude, found.latitude
        )
        * 1000,
        claim=claim,
    )


@app.get(
    "/api/found_anomalies",
    operation_id="getFoundAnomalies",
    response_model=list[FoundAnomalyPoint],
)
async def get_found_anomalies():
    """Every anomaly anyone has found, oldest find first. Kept in memory, so
    it empties when the server restarts."""
    return [
        FoundAnomalyPoint(
            longitude=a.longitude,
            latitude=a.latitude,
            event_time=_iso(a.start),
            radius=a.radius_km * 1000,
            intensity=a.intensity,
            confidence=a.confidence,
        )
        for a in found_anomalies
    ]


def _leaderboard_entry(entry: Entry) -> LeaderboardEntry:
    a = entry.anomaly
    return LeaderboardEntry(
        id=entry.id,
        rank=leaderboard.rank(entry),
        name=entry.name,
        longitude=a.longitude,
        latitude=a.latitude,
        event_time=_iso(a.start),
        radius=a.radius_km * 1000,
        intensity=a.intensity,
        confidence=a.confidence,
    )


@app.get(
    "/api/leaderboard",
    operation_id="getLeaderboard",
    response_model=list[LeaderboardEntry],
)
async def get_leaderboard():
    """The largest anomalies found so far, largest first. Kept in memory, so
    it empties when the server restarts."""
    return [_leaderboard_entry(e) for e in leaderboard.entries]


@app.put(
    "/api/leaderboard/{entry_id}/name",
    operation_id="nameLeaderboardEntry",
    response_model=LeaderboardEntry,
)
async def name_leaderboard_entry(entry_id: str, body: NameEntry):
    """Names an entry, once, with the token its finder was given."""
    try:
        entry = leaderboard.set_name(entry_id, body.token, body.name)
    except NotFound:
        raise HTTPException(404, "That anomaly is no longer on the leaderboard")
    except Forbidden:
        raise HTTPException(403, "Only the finder can name this anomaly")
    except AlreadyNamed:
        raise HTTPException(409, "This anomaly already has a name")
    return _leaderboard_entry(entry)
