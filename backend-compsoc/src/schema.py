import enum

from pydantic import BaseModel
from pydantic import BaseModel, field_validator


class GlobePoint(BaseModel):
    # (long, lat) is the id
    longitude: float # betwene -180 to 180
    latitude: float # between -90 to 90
    event_type: str
    event_time: str
    radius: float

    @field_validator("event_type")
    @classmethod
    def enum(cls, value: str, info) -> str:
        val = info.data.get("event_type")
        if val != "wildfire":
            raise ValueError("event_type is not a recognised type")
        return value

class RequestAnomaly(BaseModel):
    longitude: float
    latitude: float
    event_time: str

class Anomaly(BaseModel):
    longitude: float
    latitude: float
    confidence: float
    radius: float