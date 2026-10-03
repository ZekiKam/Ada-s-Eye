import logging
from contextlib import asynccontextmanager
from datetime import datetime, time, timezone
from pathlib import Path
from typing import Annotated

from anomalies import (
    AnomalousDetection,
    Wildfire,
    find_anomalies,
    haversine_km,
    load_detections,
    load_wildfires,
)
from dryness import load_dryness
from fastapi import FastAPI, HTTPException, Query
from grouping import AnomalyGroup, group_anomalies
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
    # A detection at or above this brightness (kelvin) can be an anomaly.
    brightness_threshold: float = 340.0
    # A wildfire explains a detection within its radius plus this distance...
    match_distance_km: float = 10.0
    # ...from this many days before its recorded date...
    match_days: int = 1
    # ...to this many days after, while it is still burning.
    burn_days: int = 14
    # Past that, a fire in the driest places can spread this much further.
    spread_km: float = 50.0
    # A detection this many spreads above normal brightness or FRP is intense.
    intensity_z: float = 2.0
    # Anomalous detections this close, and burn_days apart, are one fire.
    group_km: float = 20.0
    # How far from a queried spot request_anomaly looks for anomalies.
    query_radius_km: float = 250.0


settings = Settings()

wildfires: list[Wildfire] = []
anomalies: list[AnomalousDetection] = []
groups: list[AnomalyGroup] = []
leaderboard = Leaderboard()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global wildfires, anomalies, groups
    wildfires = load_wildfires(settings.data_dir / settings.wildfires_file)
    detections = load_detections(settings.data_dir / settings.detections_file)
    anomalies = find_anomalies(
        wildfires,
        detections,
        load_dryness(settings.data_dir / settings.climate_file),
        brightness_threshold=settings.brightness_threshold,
        match_distance_km=settings.match_distance_km,
        match_days=settings.match_days,
        burn_days=settings.burn_days,
        spread_km=settings.spread_km,
        intensity_z=settings.intensity_z,
    )
    groups = group_anomalies(
        anomalies, link_km=settings.group_km, link_days=settings.burn_days
    )
    logger.info(
        "Loaded %d wildfires and %d detections from %s; %d anomalies in %d fires",
        len(wildfires),
        len(detections),
        settings.data_dir,
        len(anomalies),
        len(groups),
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
            longitude=a.detection.longitude,
            latitude=a.detection.latitude,
            event_time=_iso(a.detection.detected_at),
            brightness=a.detection.brightness,
            frp=a.detection.frp,
            confidence=a.confidence,
            satellite_confidence=a.detection.confidence,
            radius=a.detection.radius_m,
            reasons=list(a.reasons),  # type: ignore
        )
        for a in anomalies
    ]


@app.get(
    "/api/request_anomaly",
    operation_id="requestAnomaly",
    response_model=Anomaly,
)
async def request_anomaly(request: Annotated[RequestAnomaly, Query()]):
    """The largest anomaly (a group of anomalous detections, see grouping.py)
    that started in that year with its middle within the search radius of the
    queried spot: its middle, radius and distance. With none, the queried spot
    and the search radius at confidence 0. An anomaly found for the first time
    that is among the largest goes on the leaderboard, and `claim` holds the
    token to name it."""

    def distance_km(g: AnomalyGroup) -> float:
        return haversine_km(request.longitude, request.latitude, g.longitude, g.latitude)

    # Largest first, so the first match is the largest.
    best = next(
        (
            g
            for g in groups
            if g.start.year == request.year
            and distance_km(g) <= settings.query_radius_km
        ),
        None,
    )
    if best is None:
        return Anomaly(
            longitude=request.longitude,
            latitude=request.latitude,
            confidence=0.0,
            radius=settings.query_radius_km * 1000,
            distance=0.0,
        )
    claim = None
    if entry := leaderboard.submit(best):
        claim = LeaderboardClaim(
            id=entry.id, rank=leaderboard.rank(entry), token=entry.token
        )
    return Anomaly(
        longitude=best.longitude,
        latitude=best.latitude,
        confidence=best.confidence,
        radius=best.radius_km * 1000,
        distance=distance_km(best) * 1000,
        claim=claim,
    )


def _leaderboard_entry(entry: Entry) -> LeaderboardEntry:
    g = entry.anomaly
    return LeaderboardEntry(
        id=entry.id,
        rank=leaderboard.rank(entry),
        name=entry.name,
        longitude=g.longitude,
        latitude=g.latitude,
        event_time=_iso(g.start),
        radius=g.radius_km * 1000,
        detections=len(g.members),
        confidence=g.confidence,
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
