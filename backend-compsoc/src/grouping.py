"""Group anomalous detections into the fires they came from, and size them.

A satellite sees a fire as many hot pixels spread over its area and over the
days it burns. Two anomalous detections belong to the same fire when they are
within a link distance of each other and a few days apart, and so does
anything linked to either of them (single linkage). A fire's size is its
radius: from the middle of its detections to the far edge of the furthest
one's pixel.
"""

import math
import statistics
from dataclasses import dataclass
from datetime import datetime

from anomalies import AnomalousDetection
from datasets import EARTH_RADIUS_KM, haversine_km


@dataclass(frozen=True, eq=False)
class AnomalyGroup:
    longitude: float  # middle of its detections
    latitude: float
    radius_km: float
    start: datetime  # first detection
    end: datetime  # last detection
    members: tuple[AnomalousDetection, ...]

    @property
    def confidence(self) -> float:
        return max(a.confidence for a in self.members)

    @property
    def size(self) -> tuple[float, int]:
        """For ranking: radius, then how many detections."""
        return (self.radius_km, len(self.members))


def _middle(members: list[AnomalousDetection]) -> tuple[float, float]:
    """Mean position, with longitudes unwrapped around the first member so a
    fire across the antimeridian is not put on the far side of the earth."""
    lon0 = members[0].detection.longitude
    lons = [
        lon0 + (m.detection.longitude - lon0 + 180) % 360 - 180 for m in members
    ]
    lon = (statistics.mean(lons) + 180) % 360 - 180
    return lon, statistics.mean(m.detection.latitude for m in members)


def _group(members: list[AnomalousDetection]) -> AnomalyGroup:
    lon, lat = _middle(members)
    radius_km = max(
        haversine_km(lon, lat, m.detection.longitude, m.detection.latitude)
        + m.detection.radius_m / 1000
        for m in members
    )
    times = [m.detection.detected_at for m in members]
    return AnomalyGroup(lon, lat, radius_km, min(times), max(times), tuple(members))


def group_anomalies(
    anomalies: list[AnomalousDetection], *, link_km: float, link_days: int
) -> list[AnomalyGroup]:
    """Largest first."""
    ordered = sorted(anomalies, key=lambda a: a.detection.detected_at)
    parent = list(range(len(ordered)))

    def root(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    # A degree of latitude is the same everywhere, so it rules pairs out cheaply.
    link_deg = math.degrees(link_km / EARTH_RADIUS_KM)
    window_start = 0
    for i, a in enumerate(ordered):
        d = a.detection
        while (d.detected_at - ordered[window_start].detection.detected_at).days > link_days:
            window_start += 1
        for j in range(window_start, i):
            e = ordered[j].detection
            if (
                abs(d.latitude - e.latitude) <= link_deg
                and haversine_km(d.longitude, d.latitude, e.longitude, e.latitude)
                <= link_km
            ):
                parent[root(i)] = root(j)

    members: dict[int, list[AnomalousDetection]] = {}
    for i, a in enumerate(ordered):
        members.setdefault(root(i), []).append(a)
    groups = [_group(m) for m in members.values()]
    groups.sort(key=lambda g: g.size, reverse=True)
    return groups
