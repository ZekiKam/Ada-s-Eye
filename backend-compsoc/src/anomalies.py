"""Load the two CSV data sets and find anomalies.

A recorded wildfire explains a satellite detection when their footprints, plus a
buffer distance, overlap while the fire is burning: from a few days before its
recorded date to a few weeks after. A detection is an anomaly for any of these
reasons:

- hot: no wildfire explains it and its brightness is at or above the threshold;
- spreading: no wildfire explains it, but it lies just beyond a burning
  wildfire in a dry place, where fire spreads further;
- intense: its brightness or fire radiative power is far above the other
  detections, whether or not a wildfire explains it.

Its confidence starts from the satellite's, and dryness and intensity raise it.
"""

import csv
import logging
import math
import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from dryness import Dryness

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

# The most that each of dryness and intensity can add to the confidence.
DRYNESS_WEIGHT = 0.5
INTENSITY_WEIGHT = 0.5

# Below this many detections the median and spread of brightness say little,
# so nothing is called intense.
MIN_DETECTIONS_FOR_BASELINE = 10


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


@dataclass(frozen=True)
class AnomalousDetection:
    detection: Detection
    confidence: float  # 0 to 1: the satellite's, raised by dryness and intensity
    reasons: tuple[str, ...]  # "hot", "spreading", "intense"


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


class _Baseline:
    """What normal looks like across the detections: the median and robust
    spread of brightness and of log fire radiative power, which is heavily
    skewed."""

    def __init__(self, detections: list[Detection]):
        self._brightness = self._fit([d.brightness for d in detections])
        self._log_frp = self._fit(
            [math.log(d.frp) for d in detections if d.frp and d.frp > 0]
        )

    @staticmethod
    def _fit(values: list[float]) -> tuple[float, float] | None:
        if len(values) < MIN_DETECTIONS_FOR_BASELINE:
            return None
        median = statistics.median(values)
        # The median absolute deviation, scaled to match a standard deviation.
        spread = 1.4826 * statistics.median(abs(v - median) for v in values)
        return (median, spread) if spread > 0 else None

    def z_score(self, d: Detection) -> float:
        """How many spreads above normal the brighter of the two measures is."""
        scores = [0.0]
        if self._brightness:
            median, spread = self._brightness
            scores.append((d.brightness - median) / spread)
        if self._log_frp and d.frp and d.frp > 0:
            median, spread = self._log_frp
            scores.append((math.log(d.frp) - median) / spread)
        return max(scores)


def find_anomalies(
    fires: list[Wildfire],
    detections: list[Detection],
    dryness: Dryness,
    *,
    brightness_threshold: float,
    match_distance_km: float,
    match_days: int,
    burn_days: int,
    spread_km: float,
    intensity_z: float,
) -> list[AnomalousDetection]:
    fires_by_day: dict[date, list[Wildfire]] = defaultdict(list)
    for fire in fires:
        fires_by_day[fire.day].append(fire)
    baseline = _Baseline(detections)

    def burning_fires(d: Detection):
        # Fires recorded from burn_days before the detection to match_days after.
        day = d.detected_at.date()
        for offset in range(-burn_days, match_days + 1):
            yield from fires_by_day.get(day + timedelta(days=offset), ())

    def assess(d: Detection) -> AnomalousDetection | None:
        dry = dryness.at(d.longitude, d.latitude)
        explained = False
        nearness = 0.0  # 1 at a burning fire's edge, 0 at the end of its spread
        for fire in burning_fires(d):
            distance = haversine_km(
                d.longitude, d.latitude, fire.longitude, fire.latitude
            )
            reach = (fire.radius_m + d.radius_m) / 1000 + match_distance_km
            if distance <= reach:
                explained = True
                break
            spread = spread_km * dry
            if spread > 0 and distance <= reach + spread:
                nearness = max(nearness, 1 - (distance - reach) / spread)
        z = baseline.z_score(d)

        reasons = []
        if not explained and d.brightness >= brightness_threshold:
            reasons.append("hot")
        if not explained and nearness > 0:
            reasons.append("spreading")
        if z >= intensity_z:
            reasons.append("intense")
        if not reasons:
            return None

        dryness_boost = 0.0 if explained else DRYNESS_WEIGHT * dry * nearness
        intensity_boost = INTENSITY_WEIGHT * min(max(z / intensity_z, 0.0), 1.0)
        # Each piece of evidence closes part of the gap left by the others.
        confidence = 1 - (
            (1 - d.confidence) * (1 - dryness_boost) * (1 - intensity_boost)
        )
        return AnomalousDetection(d, confidence, tuple(reasons))

    return [a for d in detections if (a := assess(d))]
