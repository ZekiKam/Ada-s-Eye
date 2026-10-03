"""Find anomalies among the satellite detections."""

from dataclasses import dataclass

from datasets import Detection, Wildfire
from dryness import Dryness


@dataclass(frozen=True)
class AnomalousDetection:
    detection: Detection
    confidence: float  # 0 to 1: the satellite's, raised by dryness and intensity
    reasons: tuple[str, ...]  # "hot", "spreading", "intense"


class _Baseline:
    """What normal looks like across the detections."""

    def __init__(self, detections: list[Detection]):
        raise NotImplementedError

    @staticmethod
    def _fit(values: list[float]) -> tuple[float, float] | None:
        raise NotImplementedError

    def z_score(self, d: Detection) -> float:
        raise NotImplementedError


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
    # TODO: anomaly detection. Returns nothing until written, so the server
    # still starts.
    return []
