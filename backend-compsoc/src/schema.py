from pydantic import BaseModel


class GlobePoint(BaseModel):
    longitude: float  # betwene -180 to 180
    latitude: float  # between -90 to 90
    event_time: str
    radius: float


class RequestAnomaly(BaseModel):
    longitude: float
    latitude: float
    year: int


class Anomaly(BaseModel):
    longitude: float
    latitude: float
    confidence: float
    radius: float


class DetectedAnomaly(BaseModel):
    """A hot satellite detection with no recorded wildfire nearby at that time."""

    longitude: float
    latitude: float
    event_time: str  # ISO 8601, UTC
    brightness: float  # kelvin
    confidence: float  # 0 to 1, from the satellite data
    radius: float  # metres
