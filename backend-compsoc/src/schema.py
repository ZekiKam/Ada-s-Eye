from typing import Annotated

from pydantic import BaseModel, StringConstraints


class GlobePoint(BaseModel):
    longitude: float  # betwene -180 to 180
    latitude: float  # between -90 to 90
    event_time: str
    radius: float


class RequestAnomaly(BaseModel):
    longitude: float
    latitude: float
    year: int


class LeaderboardClaim(BaseModel):
    """The anomaly a query found made the leaderboard. Only the finder gets
    the token, which names the entry."""

    id: str
    rank: int  # 1 for the largest
    token: str


class Anomaly(BaseModel):
    """The largest anomaly near a queried spot: its middle and radius. With
    none, the queried spot and the radius searched, at confidence 0."""

    longitude: float
    latitude: float
    confidence: float  # 0 to 1; 0 when none was found
    intensity: float  # 0 when none was found
    radius: float  # metres
    distance: float  # metres from the queried spot to its middle
    claim: LeaderboardClaim | None = None


class FoundAnomalyPoint(BaseModel):
    """An anomaly someone has found."""

    longitude: float
    latitude: float
    event_time: str  # ISO 8601, UTC: its first detection
    radius: float  # metres
    intensity: float  # brightness, kelvin
    confidence: float  # 0 to 1


class LeaderboardEntry(BaseModel):
    """One of the largest anomalies found so far."""

    id: str
    rank: int  # 1 for the largest
    name: str | None  # None until the finder names it
    longitude: float  # middle of its detections
    latitude: float
    event_time: str  # ISO 8601, UTC: its first detection
    radius: float  # metres
    intensity: float  # brightness, kelvin
    confidence: float  # 0 to 1


class NameEntry(BaseModel):
    token: str
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]
