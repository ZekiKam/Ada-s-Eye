from pydantic import BaseModel


class GlobePoint(BaseModel):
    # (long, lat) is the id
    longitude: float  # betwene -180 to 180
    latitude: float  # between -90 to 90
    event_time: str
    radius: float


class RequestAnomaly(BaseModel):
    longitude: float
    latitude: float
    event_time: str


class Anomaly(BaseModel):
    longitude: float
    latitude: float
    confidence: float
    radius: float
