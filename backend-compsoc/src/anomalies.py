"""Check on the fly for an anomaly at a queried point and year."""

import math
from dataclasses import dataclass
from datetime import datetime

from datasets import Detection, Wildfire
from dryness import Dryness


@dataclass(frozen=True)
class FoundAnomaly:
    longitude: float  # its middle
    latitude: float
    radius_km: float
    start: datetime  # first detection
    confidence: float  # 0 to 1
    intensity: float


EARTH_RADIUS_KM = 6371.0
DISTANCE_TO_FIRE = 50
BRIGHT_AVERAGE_THRESHOLD = 306
CONFIDENCE_AVERAGE_THRESHOLD = 0.57  # Detection.confidence is 0 to 1
FRP_AVERAGE_THRESHOLD = 8.6
# Detections this close to an anomaly already found that year are the same one.
SAME_ANOMALY_KM = 50


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
    found: list[FoundAnomaly],
) -> FoundAnomaly | None:
    """The anomaly within search_km of the point in that year, or None.
    Skips any already in `found`, so each anomaly is found only once."""
    print(
        f"[anomaly] query lon={longitude} lat={latitude} year={year} search_km={search_km}"
    )
    for fire in fires:
        if fire.day.year != year:
            continue

        dist = haversine_km(longitude, latitude, fire.longitude, fire.latitude)

        # skip if too close to an existing fire
        if dist < DISTANCE_TO_FIRE:
            print(f"[anomaly] blocked: known fire {dist:.1f} km away on {fire.day}")
            return None

    found_this_year = [a for a in found if a.start.year == year]

    largestAnomaly = None
    rejected = {
        "year": 0,
        "distance": 0,
        "brightness": 0,
        "confidence": 0,
        "frp": 0,
        "already found": 0,
        "smaller": 0,
    }

    for detection in detections:
        if detection.detected_at.year != year:
            rejected["year"] += 1
            continue

        dist = haversine_km(
            longitude, latitude, detection.longitude, detection.latitude
        )

        if dist > search_km:
            rejected["distance"] += 1
            continue

        if detection.brightness < BRIGHT_AVERAGE_THRESHOLD:
            rejected["brightness"] += 1
            continue

        if detection.confidence < CONFIDENCE_AVERAGE_THRESHOLD:
            rejected["confidence"] += 1
            continue

        if detection.frp and detection.frp < FRP_AVERAGE_THRESHOLD:
            rejected["frp"] += 1
            continue

        if any(
            haversine_km(
                detection.longitude, detection.latitude, a.longitude, a.latitude
            )
            < SAME_ANOMALY_KM
            for a in found_this_year
        ):
            rejected["already found"] += 1
            continue

        if largestAnomaly and detection.radius_m / 1000 < largestAnomaly.radius_km:
            rejected["smaller"] += 1
            continue

        largestAnomaly = FoundAnomaly(
            longitude=detection.longitude,
            latitude=detection.latitude,
            radius_km=detection.radius_m / 1000,
            start=detection.detected_at,
            confidence=detection.confidence,
            intensity=detection.brightness,
        )

    print(f"[anomaly] {len(detections)} detections, rejected {rejected}")
    print(f"[anomaly] result: {largestAnomaly}")
    return largestAnomaly
