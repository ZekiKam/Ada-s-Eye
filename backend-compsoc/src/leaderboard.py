"""Every anomaly found through request_anomaly, and the largest of them.

Held in memory only, so it empties when the server restarts. Size is an
anomaly's radius in km, then its intensity (brightness in kelvin).
Each anomaly is found once, credited to whoever found it. Finding one hands
back a token, which lets that finder (and nobody else) put a name to it.
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
    """No such entry."""


class Forbidden(Exception):
    """The token does not match the entry."""


class AlreadyNamed(Exception):
    pass


class Leaderboard:
    def __init__(self, length: int = 5):
        self.length = length
        self.found: list[Entry] = []  # every find, oldest first
        self.entries: list[Entry] = []  # the board: the largest, largest first

    def submit(self, anomaly: FoundAnomaly) -> Entry | None:
        """Records a newly found anomaly, and puts it on the board if it is
        among the largest. Returns its entry, or None if already found."""
        if any(e.anomaly == anomaly for e in self.found):
            return None
        entry = Entry(
            id=secrets.token_urlsafe(8),
            token=secrets.token_urlsafe(16),
            anomaly=anomaly,
        )
        self.found.append(entry)
        # Stable sort: on a tie, the earlier find keeps its place.
        self.entries = sorted(
            [*self.entries, entry],
            key=lambda e: (e.anomaly.radius_km, e.anomaly.intensity),
            reverse=True,
        )[: self.length]
        return entry

    def rank(self, entry: Entry) -> int | None:
        """1 for the largest; None when it is not on the board."""
        return self.entries.index(entry) + 1 if entry in self.entries else None

    def set_name(self, entry_id: str, token: str, name: str) -> Entry:
        entry = next((e for e in self.found if e.id == entry_id), None)
        if entry is None:
            raise NotFound
        if not secrets.compare_digest(entry.token, token):
            raise Forbidden
        if entry.name is not None:
            raise AlreadyNamed
        entry.name = name
        return entry
