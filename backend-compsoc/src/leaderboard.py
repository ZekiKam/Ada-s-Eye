"""The largest anomalies found through request_anomaly.

Held in memory only, so it empties when the server restarts. Size is an
anomaly's radius in km, then its intensity (brightness in kelvin).
Each anomaly is listed once, credited to whoever found it first. Finding one
hands back a token, which lets that finder (and nobody else) put a name to it.
"""

import secrets
from dataclasses import dataclass

from anomalies import FoundAnomaly


@dataclass
class Entry:
    id: str
    token: str
    anomaly: FoundAnomaly
    name: str | None = None


class NotFound(Exception):
    """No such entry, or it has since been pushed off the board."""


class Forbidden(Exception):
    """The token does not match the entry."""


class AlreadyNamed(Exception):
    pass


class Leaderboard:
    def __init__(self, length: int = 5):
        self.length = length
        self.entries: list[Entry] = []  # largest first

    def submit(self, anomaly: FoundAnomaly) -> Entry | None:
        """Adds a newly found anomaly if it is among the largest. Returns its
        entry, or None if it is too small or already listed."""
        if any(e.anomaly == anomaly for e in self.entries):
            return None
        entry = Entry(
            id=secrets.token_urlsafe(8),
            token=secrets.token_urlsafe(16),
            anomaly=anomaly,
        )
        # Stable sort: on a tie, the earlier find keeps its place.
        ranked = sorted(
            [*self.entries, entry],
            key=lambda e: (e.anomaly.radius_km, e.anomaly.intensity),
            reverse=True,
        )[: self.length]
        if entry not in ranked:
            return None
        self.entries = ranked
        return entry

    def rank(self, entry: Entry) -> int:
        """1 for the largest."""
        return self.entries.index(entry) + 1

    def set_name(self, entry_id: str, token: str, name: str) -> Entry:
        entry = next((e for e in self.entries if e.id == entry_id), None)
        if entry is None:
            raise NotFound
        if not secrets.compare_digest(entry.token, token):
            raise Forbidden
        if entry.name is not None:
            raise AlreadyNamed
        entry.name = name
        return entry
