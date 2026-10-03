"""Check on the fly for an anomaly at a queried point and year."""

from dataclasses import dataclass
from datetime import datetime
import math

from datasets import Detection, Wildfire
from dryness import Dryness
import numpy as np


@dataclass(frozen=True)
class FoundAnomaly:
    longitude: float  # its middle
    latitude: float
    radius_km: float
    start: datetime  # first detection
    detections: int
    confidence: float  # 0 to 1
    intensity: float



EARTH_RADIUS_KM = 6371.0
DISTANCE_TO_FIRE = 50
BRIGHT

def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dlam = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    )
    # Rounding can push a just past 1 for points on opposite sides of the earth.
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(min(a, 1.0)))

def find_anomaly(
    longitude: float,
    latitude: float,
    year: int,
    *,
    search_km: float,
    fires: list[Wildfire],
    detections: list[Detection],
    dryness: Dryness,
) -> FoundAnomaly | None:
    """The anomaly within search_km of the point in that year, or None."""
    for fire in fires:
        if fire.day.year != year:
            continue

        dist = haversine_km(longitude, latitude, fire.longitude, fire.latitude)

        # skip if too close to an existing fire
        if dist < DISTANCE_TO_FIRE:
            return None

    for detection in detections:
        dist = haversine_km(longitude, latitude, detection.longitude, detection.latitude)

        if dist > search_km:
            continue

        if detection.brightness > 



        
    return None
