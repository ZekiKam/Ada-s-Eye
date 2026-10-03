"""Load the two CSV data sets."""

import csv
import logging
import math
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

EARTH_RADIUS_KM = 6371.0

# VIIRS reports confidence as a letter rather than a percentage.
VIIRS_CONFIDENCE = {
    "l": 0.3,
    "low": 0.3,
    "n": 0.6,
    "nominal": 0.6,
    "h": 0.9,
    "high": 0.9,
}


@dataclass(frozen=True)
class Wildfire:
    longitude: float
    latitude: float
    day: date
    radius_m: float


@dataclass(frozen=True)
class Detection:
    longitude: float
    latitude: float
    detected_at: datetime
    brightness: float  # kelvin
    frp: float | None  # fire radiative power, megawatts
    confidence: float  # 0 to 1
    radius_m: float  # half the larger side of the satellite pixel


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


def _parse_confidence(raw: str) -> float:
    raw = raw.strip().lower()
    if raw in VIIRS_CONFIDENCE:
        return VIIRS_CONFIDENCE[raw]
    return min(max(float(raw) / 100, 0.0), 1.0)


def _parse_acq_time(raw: str) -> time:
    # FIRMS writes HHMM in UTC, sometimes without leading zeros (e.g. "512").
    raw = raw.strip().zfill(4)
    return time(int(raw[:2]), int(raw[2:]), tzinfo=timezone.utc)


def load_wildfires(path: Path) -> list[Wildfire]:
    """Columns: latitude, longitude, date (YYYY-MM-DD), radius_m."""
    fires = []
    with path.open(newline="", encoding="utf-8") as f:
        for line, row in enumerate(csv.DictReader(f), start=2):
            try:
                fires.append(
                    Wildfire(
                        longitude=float(row["longitude"]),
                        latitude=float(row["latitude"]),
                        day=date.fromisoformat(row["date"].strip()),
                        radius_m=float(row["radius_m"]),
                    )
                )
            except (KeyError, ValueError) as e:
                logger.warning("%s line %d skipped: %s", path.name, line, e)
    return fires


def load_detections(path: Path) -> list[Detection]:
    """NASA FIRMS columns: latitude, longitude, brightness (or bright_ti4 for
    VIIRS), frp, scan, track, acq_date, acq_time, confidence. Others are
    ignored."""
    detections = []
    with path.open(newline="", encoding="utf-8") as f:
        for line, row in enumerate(csv.DictReader(f), start=2):
            try:
                brightness = row.get("brightness") or row["bright_ti4"]
                frp = row.get("frp", "").strip()
                detected_at = datetime.combine(
                    date.fromisoformat(row["acq_date"].strip()),
                    _parse_acq_time(row["acq_time"]),
                )
                pixel_km = max(
                    float(row.get("scan") or 1), float(row.get("track") or 1)
                )
                detections.append(
                    Detection(
                        longitude=float(row["longitude"]),
                        latitude=float(row["latitude"]),
                        detected_at=detected_at,
                        brightness=float(brightness),
                        frp=float(frp) if frp else None,
                        confidence=_parse_confidence(row["confidence"]),
                        radius_m=pixel_km * 1000 / 2,
                    )
                )
            except (KeyError, ValueError) as e:
                logger.warning("%s line %d skipped: %s", path.name, line, e)
    return detections
