"""Synthesise data/wildfires.csv and data/satellite_detections.csv.

The real data in data/real/ only covers the UK, so it sets how a detection
looks, and the Köppen-Geiger grid sets where and when fires burn worldwide:

- fire_archive_M-C61_*.csv (NASA FIRMS MODIS, UK, 2000-2026): brightness
  by day and night, pixel scan and track, overpass times, how fire radiative
  power and confidence follow brightness, the seasons of fire in an oceanic
  climate, and whole rows for static industrial sources;
- real_fire_london.csv (London Fire Brigade incidents, 2010-2017): the
  weekly rhythm of fires that people start;
- koeppen_geiger.txt.gz (Kottek et al. 2006): the climate of every 0.5 degree
  land cell, which sets how much burns there, in which months, how big the
  fires grow and how hot they burn.

nasa_firm_london.csv holds the same UK detections for 2010-2017 in other
columns, so it adds nothing and is not read.

Fires burn from 2010 to LAST_DAY. Each one is a true fire on the
ground; the satellite sees every true fire, but only some are recorded as
wildfires: most in North America, Europe and Australia, few in central Africa,
and big fires more often than small ones. Unrecorded big fires, fires that grow
past their recorded size and spot fires thrown ahead in dry places are what
the backend should find as anomalies. Crop burning and industrial heat add
detections that no wildfire explains but that are rarely hot.

Run from backend-compsoc/: uv run python scripts/synthesise_data.py
"""

import csv
import gzip
import math
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parent.parent / "data"
REAL = DATA / "real"
SEED = 2026

FIRST_YEAR = 2010
# Fixed rather than today, so a rerun with the same seed gives the same files.
LAST_DAY = date(2026, 9, 30)

# True fires and crop burns in an ordinary year, before notable seasons.
TRUE_FIRES_PER_YEAR = 420
CROP_BURNS_PER_YEAR = 500
# Static sources: detections a year at each site.
STATIC_DETECTIONS_PER_YEAR = 6

CELL_DEG = 0.5


# ---------------------------------------------------------------------------
# Climate: how much burns, when, how big and how hot.


# Fires a year per unit of land area, relative to oceanic climates' 1.
ACTIVITY = {
    "Aw": 8, "As": 6, "Am": 3, "Af": 1.2,
    "BSh": 4, "BSk": 3, "BWh": 0.15, "BWk": 0.3,
    "Csa": 6, "Csb": 6, "Csc": 3,
    "Cwa": 4, "Cwb": 4, "Cwc": 2,
    "Cfa": 3, "Cfb": 2, "Cfc": 0.5,
    "Dfa": 2, "Dfb": 2, "Dfc": 3, "Dfd": 2.5,
    "Dsa": 1.5, "Dsb": 1.5, "Dsc": 1.5,
    "Dwa": 2.5, "Dwb": 2.5, "Dwc": 2.5, "Dwd": 2,
    "ET": 0.05, "EF": 0,
}  # fmt: skip

# Crop and pasture burning a year per unit of land area.
CROP_ACTIVITY = {
    "Cfa": 3, "Dfa": 3, "Dfb": 2, "Cwa": 3, "BSk": 1.5,
    "Aw": 2, "Am": 1, "Csa": 1, "Cfb": 0.5,
}  # fmt: skip

# Same as src/dryness.py, which the backend uses.
DRYNESS = {
    **dict.fromkeys(["BWh", "BWk"], 1.0),
    **dict.fromkeys(["BSh", "BSk"], 0.9),
    **dict.fromkeys(["Csa", "Csb", "Csc"], 0.8),
    **dict.fromkeys(["Aw", "As"], 0.7),
    **dict.fromkeys(
        ["Cwa", "Cwb", "Cwc", "Dsa", "Dsb", "Dsc", "Dwa", "Dwb", "Dwc", "Dwd"], 0.5
    ),
    **dict.fromkeys(["Am", "Cfa", "Cfb", "Cfc", "Dfa", "Dfb", "Dfc", "Dfd"], 0.3),
    "Af": 0.1,
    **dict.fromkeys(["ET", "EF"], 0.0),
}


def fire_season(cls: str, lat: float, lon: float) -> list[tuple[float, float, float]]:
    """Peaks of the fire season as (month 1-12, spread in months, weight).
    Mostly the local dry season, which flips across the equator."""
    north = lat >= 0
    if cls == "Af":
        return [(9, 1.5, 1)]  # Sumatra and Borneo, Aug-Oct
    if cls in ("Aw", "As", "Am"):
        if not north:
            return [(9, 1.3, 1)]  # Angola, Zambia, cerrado, north Australia
        if 60 <= lon <= 130:
            return [(3, 1.2, 1)]  # India and mainland Southeast Asia
        if lon < -30:
            return [(4, 1.2, 1)]  # Central America
        return [(1, 1.4, 1)]  # Sahel and West Africa
    if cls == "BSh":
        if not north:
            return [(11, 1.6, 1)]
        return [(12, 1.6, 1)] if -20 <= lon <= 60 else [(4, 1.5, 1)]
    if cls == "BSk":
        return [(8, 1.5, 1)] if north else [(1, 1.5, 1)]
    if cls.startswith("BW"):
        return [(7, 2.0, 1)] if north else [(1, 2.0, 1)]
    if cls.startswith("Cs"):
        return [(8, 1.3, 1)] if north else [(1, 1.3, 1)]
    if cls.startswith("Cw"):
        return [(3, 1.3, 1)] if north else [(8, 1.3, 1)]
    if cls == "Cfa":
        if north:
            return [(3, 1.4, 0.7), (10, 1.2, 0.3)]  # US Southeast, China
        return [(12, 1.8, 1)]  # eastern Australia, Pampas
    if cls in ("Dfa", "Dfb"):
        return [(4, 1.0, 0.6), (8.5, 1.3, 0.4)]  # spring grass, then stubble
    if cls in ("Dfc", "Dfd", "ET"):
        return [(7, 1.1, 1)]  # boreal summer
    if cls.startswith("Ds"):
        return [(8, 1.3, 1)]
    if cls.startswith("Dw"):
        return [(4.5, 1.0, 0.65), (9.5, 1.0, 0.35)]
    return []  # Cfb and Cfc use the UK's real months instead


CROP_SEASON_NORTH = [(4, 1.0, 0.4), (10, 1.0, 0.6)]  # spring, then harvest
CROP_SEASON_SOUTH = [(9, 1.2, 1)]


def season_weights(peaks, oceanic_months: np.ndarray, south: bool) -> np.ndarray:
    """Relative weight of each month, January first."""
    if not peaks:
        months = oceanic_months
        return np.roll(months, 6) if south else months
    m = np.arange(1, 13)
    w = np.full(12, 0.03)
    for peak, spread, weight in peaks:
        d = (m - peak + 6) % 12 - 6  # months from the peak, wrapping round
        w += weight * np.exp(-0.5 * (d / spread) ** 2)
    return w / w.sum()


# Median radius (km) and log spread of true fire size, and how many kelvin
# above a small UK fire its detections burn on average.
def regime(cls: str) -> tuple[float, float, float]:
    if cls in ("Dfc", "Dfd", "ET") or cls.startswith("Dw"):
        return 3.0, 1.0, 30  # boreal: big, crowning
    if cls.startswith("Cs"):
        return 1.2, 1.1, 32  # Mediterranean: fast and hot
    if cls in ("Aw", "As", "BSh"):
        return 2.0, 0.9, 18  # savanna grass
    if cls.startswith("B"):
        return 1.5, 1.0, 20
    if cls in ("Af", "Am"):
        return 0.8, 0.9, 15  # forest clearing
    return 0.6, 0.9, 12  # temperate


# ---------------------------------------------------------------------------
# Regions: names, how often their fires are recorded, and notable seasons.

# (name, lat min, lat max, lon min, lon max, share of fires recorded). The
# first that holds a point names it.
REGIONS = [
    ("Hawaii", 18, 23, -161, -154, 0.95),
    ("Alaska", 51, 72, -170, -129, 0.9),
    ("British Columbia", 48.3, 60, -139, -114, 0.9),
    ("Alberta", 49, 60, -120, -110, 0.9),
    ("Northwest Territories", 60, 70, -136, -102, 0.85),
    ("Canadian Prairies", 49, 60, -110, -95, 0.9),
    ("Ontario", 42, 57, -95, -74, 0.9),
    ("Quebec", 45, 63, -80, -57, 0.85),
    ("California", 32.5, 42, -125, -114, 0.95),
    ("Pacific Northwest", 42, 49, -125, -116, 0.95),
    ("Great Basin", 35, 49, -116, -104, 0.9),
    ("Southwest US", 31, 37, -114, -103, 0.9),
    ("Great Plains", 29, 49, -104, -94, 0.9),
    ("Southeast US", 24.5, 37, -94, -75, 0.9),
    ("Northeast US", 37, 48, -94, -66, 0.9),
    ("Mexico", 14, 32.5, -118, -86, 0.4),
    ("Central America", 7, 18, -92, -77, 0.4),
    ("Caribbean", 10, 27, -85, -59, 0.5),
    ("Central Chile", -42, -28, -76, -69, 0.85),
    ("Patagonia", -56, -38, -76, -62, 0.6),
    ("Pampas", -39, -28, -66, -53, 0.6),
    ("Pantanal", -22, -15, -59, -54, 0.5),
    ("Chaco", -30, -17, -66, -56, 0.4),
    ("Cerrado", -24, -5, -55, -41, 0.35),
    ("Northeast Brazil", -16, 0, -45, -34, 0.5),
    ("Amazon", -15, 5, -75, -45, 0.3),
    ("Andes", -20, 13, -82, -60, 0.25),
    ("British Isles", 49.5, 61, -11, 2, 0.95),
    ("Iberia", 36, 44, -10, 3.5, 0.95),
    ("France", 42, 51, -5, 8, 0.95),
    ("Scandinavia", 55, 72, 4, 32, 0.95),
    ("Italy", 36, 47, 6, 19, 0.95),
    ("Greece", 34.5, 42, 19, 28.5, 0.9),
    ("Balkans", 39, 47, 13, 30, 0.8),
    ("Central Europe", 45, 55, 3, 25, 0.9),
    ("Turkey", 35.5, 42.5, 26, 45, 0.8),
    ("Eastern Europe", 44, 60, 22, 45, 0.6),
    ("Levant", 29, 37.5, 34, 43, 0.6),
    ("Maghreb", 27, 38, -10, 12, 0.5),
    ("Sahara", 17, 27, -18, 35, 0.2),
    ("Sahel", 11, 17, -18, 40, 0.15),
    ("West Africa", 4, 11, -18, 10, 0.15),
    ("Central African Savanna", 3, 11, 10, 35, 0.15),
    ("Horn of Africa", -2, 18, 35, 52, 0.2),
    ("Congo Basin", -5, 3, 10, 32, 0.1),
    ("Southern Africa", -35, -18, 11, 33, 0.6),
    ("Angola", -18, -5, 11, 22, 0.15),
    ("Zambia", -18, -8, 22, 34, 0.2),
    ("East Africa", -12, -2, 29, 42, 0.25),
    ("Mozambique", -27, -10, 32, 41, 0.2),
    ("Madagascar", -26, -11, 43, 51, 0.2),
    ("Arabian Peninsula", 12, 32, 34, 60, 0.4),
    ("Iran", 25, 40, 44, 63, 0.4),
    ("Central Asia", 35, 55, 46, 87, 0.35),
    ("Yakutia", 56, 73, 105, 150, 0.45),
    ("West Siberia", 50, 75, 60, 90, 0.5),
    ("East Siberia", 50, 75, 90, 140, 0.45),
    ("Russian Far East", 42, 72, 130, 180, 0.45),
    ("Mongolia", 41, 52, 87, 120, 0.4),
    ("Northeast China", 38, 54, 115, 135, 0.6),
    ("Korea and Japan", 30, 46, 124, 146, 0.9),
    ("China", 18, 41, 73, 123, 0.3),
    ("Indian Subcontinent", 5, 36, 60, 92, 0.3),
    ("Mainland Southeast Asia", 9, 28, 92, 110, 0.35),
    ("Philippines", 4, 21, 116, 127, 0.4),
    ("Sumatra", -6, 6, 95, 106, 0.45),
    ("Borneo", -4.5, 7.5, 108, 119.5, 0.45),
    ("New Guinea", -11, 0, 130, 151, 0.2),
    ("Indonesia", -11, 6, 106, 141, 0.4),
    ("Northern Australia", -21, -10, 112, 154, 0.85),
    ("Victoria", -39.5, -33.9, 140.9, 150, 0.9),
    ("New South Wales", -37.5, -28, 141, 154, 0.9),
    ("Queensland", -29, -21, 138, 154, 0.85),
    ("Tasmania", -44, -39.5, 143, 149, 0.9),
    ("South Australia", -38, -26, 129, 141, 0.85),
    ("Western Australia", -36, -13, 112, 129, 0.85),
    ("New Zealand", -48, -34, 165, 179, 0.9),
    ("Greenland", 59, 84, -74, -10, 0.9),
    # Whatever the boxes above miss.
    ("North America", 7, 84, -170, -50, 0.8),
    ("South America", -56, 13, -82, -34, 0.4),
    ("Europe", 35, 72, -25, 45, 0.85),
    ("Africa", -35, 37, -18, 52, 0.2),
    ("Asia", -11, 82, 25, 180, 0.4),
    ("Oceania", -50, 0, 110, 180, 0.6),
]
FALLBACK_REGION = ("Remote", 0.3)

# Seasons that burned far beyond the usual: (regions, first day, last day,
# how many times the usual number of fires).
NOTABLE_SEASONS = [
    (["Iberia"], "2017-06-01", "2017-10-31", 3.0),
    (["Iberia"], "2022-06-01", "2022-08-31", 2.0),
    (["Iberia"], "2025-07-15", "2025-08-31", 2.5),
    (["France"], "2022-06-15", "2022-08-31", 2.0),
    (["Greece"], "2018-07-01", "2018-08-31", 1.5),
    (["Greece", "Turkey"], "2021-07-15", "2021-08-31", 3.0),
    (["Greece"], "2023-07-01", "2023-08-31", 2.5),
    (["British Isles"], "2018-06-15", "2018-08-15", 2.5),
    (["British Isles"], "2022-07-01", "2022-08-31", 2.5),
    (["British Isles"], "2025-03-01", "2025-05-31", 2.0),
    (["California"], "2018-07-01", "2018-11-30", 2.5),
    (["California", "Pacific Northwest"], "2020-08-01", "2020-10-31", 3.5),
    (["California"], "2021-07-01", "2021-09-30", 2.0),
    (["California"], "2025-01-01", "2025-01-31", 4.0),
    (["Alberta"], "2016-05-01", "2016-06-30", 2.0),
    (["Northwest Territories"], "2014-06-01", "2014-08-31", 2.0),
    (["British Columbia"], "2017-07-01", "2018-08-31", 2.0),
    (
        ["Alberta", "British Columbia", "Northwest Territories", "Quebec",
         "Ontario", "Canadian Prairies"],
        "2023-05-01", "2023-09-30", 4.0,
    ),  # fmt: skip
    (["Alberta", "British Columbia", "Northwest Territories"], "2024-05-01", "2024-09-30", 2.0),
    (["Canadian Prairies", "Ontario", "Alberta"], "2025-05-01", "2025-08-31", 2.5),
    (["Alaska"], "2015-06-01", "2015-08-31", 2.0),
    (["Alaska"], "2022-06-01", "2022-07-31", 2.0),
    (
        ["New South Wales", "Victoria", "Queensland", "South Australia"],
        "2019-09-01", "2020-02-29", 4.0,
    ),  # fmt: skip
    (["Central Chile"], "2017-01-01", "2017-02-28", 3.0),
    (["Central Chile"], "2023-02-01", "2023-02-28", 2.0),
    (["Central Chile"], "2024-02-01", "2024-02-29", 2.0),
    (["Yakutia", "East Siberia"], "2019-06-01", "2019-08-31", 2.5),
    (["Yakutia", "East Siberia"], "2020-06-01", "2020-08-31", 2.5),
    (["Yakutia"], "2021-06-01", "2021-08-31", 3.0),
    (["Amazon"], "2019-07-15", "2019-09-30", 1.8),
    (["Amazon", "Chaco"], "2024-08-01", "2024-10-15", 2.5),
    (["Pantanal"], "2020-07-15", "2020-10-31", 3.0),
    (["Pantanal"], "2024-06-01", "2024-09-30", 3.0),
    (["Sumatra", "Borneo", "Indonesia"], "2015-08-01", "2015-10-31", 4.0),
    (["Sumatra", "Borneo", "Indonesia"], "2019-08-01", "2019-10-31", 2.5),
    (["Sumatra", "Borneo", "Indonesia"], "2023-08-15", "2023-10-31", 1.8),
    (["Hawaii"], "2023-08-01", "2023-08-31", 3.0),
]
# Notable seasons grow bigger fires as well as more.
NOTABLE_SIZE_FACTOR = 1.4
# Each region's year also varies this much (log spread) by chance.
YEARLY_SPREAD = 0.3

# Share of ignitions that people start, by climate. The rest are lightning,
# which keeps no weekly rhythm.
HUMAN_SHARE_BOREAL = 0.4
HUMAN_SHARE = 0.85

# Industrial heat and gas flares beyond the UK's own (which come from the
# real archive): (lat, lon).
GLOBAL_STATIC_SITES = [
    (5.05, 6.65), (4.85, 7.05), (5.55, 5.85),  # Niger Delta
    (30.55, 47.65), (30.95, 47.35), (29.15, 47.85),  # Basra, Kuwait
    (26.55, 50.05), (25.35, 49.55),  # Eastern Province
    (61.25, 73.45), (61.85, 75.25), (62.15, 77.35),  # Khanty-Mansiysk
    (31.85, -103.25), (32.15, -103.85),  # Permian Basin
    (47.95, -103.35),  # Bakken
    (31.75, 6.05), (28.15, 9.55),  # Hassi Messaoud, Illizi
    (28.65, 21.35),  # Sirte Basin
    (9.75, -63.25),  # Maturin
    (37.25, 55.05),  # Turkmenistan
    (21.65, -97.85),  # Gulf of Mexico shore
]  # fmt: skip


# ---------------------------------------------------------------------------
# Loading the real data.


def load_climate() -> list[tuple[float, float, str]]:
    with gzip.open(REAL / "koeppen_geiger.txt.gz", "rt", encoding="utf-8") as f:
        next(f)
        return [
            (float(lat), float(lon), cls)
            for lat, lon, cls in (line.split() for line in f)
            if ACTIVITY.get(cls, 0) > 0
        ]


def load_archive() -> list[dict]:
    rows = []
    path = next(REAL.glob("fire_archive_M-C61_*.csv"))
    with path.open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(
                {
                    "lat": float(r["latitude"]),
                    "lon": float(r["longitude"]),
                    "brightness": float(r["brightness"]),
                    "scan": float(r["scan"]),
                    "track": float(r["track"]),
                    "date": date.fromisoformat(r["acq_date"]),
                    "time": int(r["acq_time"]),
                    "satellite": r["satellite"],
                    "confidence": int(r["confidence"]),
                    "t31": float(r["bright_t31"]),
                    "frp": float(r["frp"]),
                    "daynight": r["daynight"],
                    "type": int(r["type"]),
                }
            )
    return rows


def london_weekday_weights() -> np.ndarray:
    """Fires that people start in London on each weekday, Monday first, over
    the mean."""
    counts = np.zeros(7)
    with (REAL / "real_fire_london.csv").open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            counts[date.fromisoformat(r["date"]).weekday()] += 1
    return counts / counts.mean()


class Instrument:
    """How MODIS saw UK fires, to dress synthetic fires the same way."""

    def __init__(self, archive: list[dict], rng: np.random.Generator):
        self.rng = rng
        veg = [r for r in archive if r["type"] == 0]
        self.static_rows = [r for r in archive if r["type"] == 2]
        self.day_share = sum(r["daynight"] == "D" for r in veg) / len(veg)

        self.brightness = {
            dn: np.array([r["brightness"] for r in veg if r["daynight"] == dn])
            for dn in "DN"
        }
        self.pixels = np.array([(r["scan"], r["track"]) for r in archive])

        # Local solar time of each overpass, in hours, by satellite and
        # day or night.
        self.local_hours = defaultdict(list)
        for r in archive:
            utc = r["time"] // 100 + r["time"] % 100 / 60
            local = (utc + r["lon"] / 15) % 24
            self.local_hours[r["satellite"], r["daynight"]].append(local)
        self.local_hours = {k: np.array(v) for k, v in self.local_hours.items()}

        # Monthly seasons of UK vegetation fires, for oceanic climates.
        months = np.bincount([r["date"].month - 1 for r in veg], minlength=12)
        self.oceanic_months = months / months.sum()

        # The 11 µm background: a UK median by day or night and month, and
        # what is left over (the fire's own share, plus noise) to bootstrap.
        by = defaultdict(list)
        for r in veg:
            by[r["daynight"], r["date"].month].append(r["t31"])
        self.t31_median = {k: float(np.median(v)) for k, v in by.items()}
        self.t31_annual = {
            dn: float(np.median([r["t31"] for r in veg if r["daynight"] == dn]))
            for dn in "DN"
        }
        self.t31_residual = np.array(
            [r["t31"] - self.t31_median[r["daynight"], r["date"].month] for r in veg]
        )

        # Fire radiative power follows the contrast between the 4 µm and 11 µm
        # brightness and the pixel's area: least squares on the log, with the
        # residuals kept to bootstrap.
        x = np.array(
            [
                (1, r["brightness"] - r["t31"], math.log(r["scan"] * r["track"]))
                for r in veg
                if r["frp"] > 0
            ]
        )
        y = np.log([r["frp"] for r in veg if r["frp"] > 0])
        self.frp_coef, *_ = np.linalg.lstsq(x, y, rcond=None)
        self.frp_residual = y - x @ self.frp_coef

        # Confidence given brightness: the UK confidences in each 2 K band,
        # by day or night, with sparse bands merged into the band below.
        self.confidence = {}
        for dn in "DN":
            bands = defaultdict(list)
            for r in veg:
                if r["daynight"] == dn:
                    bands[int(r["brightness"] // 2)].append(r["confidence"])
            merged, carry = {}, []
            for band in sorted(bands):
                carry = bands[band] if len(bands[band]) >= 30 else carry + bands[band]
                if len(carry) >= 30:
                    merged[band] = np.array(carry)
            self.confidence[dn] = merged

    def overpass(self, local_day: date, lon: float) -> tuple[datetime, str, str]:
        rng = self.rng
        satellite = "Terra" if rng.random() < 0.5 else "Aqua"
        dn = "D" if rng.random() < self.day_share else "N"
        local = rng.choice(self.local_hours[satellite, dn])
        utc = datetime.combine(local_day, datetime.min.time()) + timedelta(
            hours=float(local - lon / 15)
        )
        return utc, satellite, dn

    def uk_brightness(self, dn: str) -> float:
        return float(self.rng.choice(self.brightness[dn]))

    def pixel(self) -> tuple[float, float]:
        scan, track = self.pixels[self.rng.integers(len(self.pixels))]
        return float(scan), float(track)

    def t31(self, lat: float, month: int, dn: str, dryness: float) -> float:
        """Background brightness: the UK's, warmer towards the equator and in
        dry places, with the UK's seasons scaled by latitude."""
        uk_season = self.t31_median[dn, month] - self.t31_annual[dn]
        # The UK sits near 54°N; seasons swap across the equator and fade
        # towards it.
        if lat < 0:
            uk_season = self.t31_median[dn, (month + 5) % 12 + 1] - self.t31_annual[dn]
        season = uk_season * min(abs(lat), 60) / 54
        ambient = (
            self.t31_annual[dn]
            - 0.35 * (abs(lat) - 54)
            + season
            + 10 * (dryness - 0.3)
        )
        return ambient + float(self.rng.choice(self.t31_residual))

    def frp(self, brightness: float, t31: float, scan: float, track: float) -> float:
        a, b, c = self.frp_coef
        log_frp = a + b * (brightness - t31) + c * math.log(scan * track)
        return min(math.exp(log_frp + self.rng.choice(self.frp_residual)), 4000.0)

    def conf(self, brightness: float, dn: str) -> int:
        bands = self.confidence[dn]
        band = int(brightness // 2)
        keys = sorted(bands)
        if band not in bands:
            # Nearest band at or below, else the lowest.
            below = [k for k in keys if k <= band]
            band = below[-1] if below else keys[0]
        return int(self.rng.choice(bands[band]))


# ---------------------------------------------------------------------------
# Geography helpers.


def region_of(lat: float, lon: float) -> tuple[str, float]:
    for name, lat0, lat1, lon0, lon1, recorded in REGIONS:
        if lat0 <= lat <= lat1 and lon0 <= lon <= lon1:
            return name, recorded
    return FALLBACK_REGION


def offset(lat: float, lon: float, km: float, bearing: float) -> tuple[float, float]:
    dlat = km / 111.32 * math.cos(bearing)
    dlon = km / (111.32 * max(math.cos(math.radians(lat)), 0.05)) * math.sin(bearing)
    lon = (lon + dlon + 180) % 360 - 180
    return max(min(lat + dlat, 89.9), -89.9), lon


def month_days(year: int, month: int) -> list[date]:
    first = date(year, month, 1)
    nxt = date(year + month // 12, month % 12 + 1, 1)
    return [
        first + timedelta(days=i)
        for i in range((nxt - first).days)
        if first + timedelta(days=i) <= LAST_DAY
    ]


# ---------------------------------------------------------------------------
# The synthesis.


def main() -> None:
    rng = np.random.default_rng(SEED)
    archive = load_archive()
    instrument = Instrument(archive, rng)
    weekday = london_weekday_weights()
    cells = load_climate()
    print(f"{len(archive)} UK detections, {len(cells)} burnable climate cells")

    lat = np.array([c[0] for c in cells])
    lon = np.array([c[1] for c in cells])
    cls = [c[2] for c in cells]
    area = np.cos(np.radians(lat))
    regions = [region_of(a, o) for a, o in zip(lat, lon)]
    region_names = sorted({r[0] for r in regions})
    region_index = np.array([region_names.index(r[0]) for r in regions])

    # Fires and crop burns a cell sees in each month of an ordinary year.
    def monthly(activity: dict, seasons) -> np.ndarray:
        out = np.zeros((len(cells), 12))
        for i, (a, o, c) in enumerate(cells):
            if activity.get(c, 0):
                out[i] = area[i] * activity[c] * seasons(c, a, o)
        return out

    fire_base = monthly(
        ACTIVITY,
        lambda c, a, o: season_weights(
            fire_season(c, a, o), instrument.oceanic_months, a < 0
        ),
    )
    crop_base = monthly(
        CROP_ACTIVITY,
        lambda c, a, o: season_weights(
            CROP_SEASON_NORTH if a >= 0 else CROP_SEASON_SOUTH, None, a < 0
        ),
    )

    notable = [
        (
            {region_names.index(n) for n in names if n in region_names},
            date.fromisoformat(start),
            date.fromisoformat(end),
            factor,
        )
        for names, start, end, factor in NOTABLE_SEASONS
    ]

    def boost(year: int, month: int) -> np.ndarray:
        """Each region's multiplier on its usual fires that month."""
        out = yearly[year].copy()
        first, last = date(year, month, 1), month_days(year, month)[-1]
        for idx, start, end, factor in notable:
            if start <= last and end >= first:
                for i in idx:
                    out[i] *= factor
        return out

    yearly = {
        y: rng.lognormal(0, YEARLY_SPREAD, len(region_names))
        for y in range(FIRST_YEAR, LAST_DAY.year + 1)
    }

    wildfires: list[dict] = []
    detections: list[dict] = []
    stats = Counter()

    def detect(
        lat: float,
        lon: float,
        local_day: date,
        brightness_gain: float,
        dryness: float,
        kind: int = 0,
    ) -> None:
        when, satellite, dn = instrument.overpass(local_day, lon)
        scan, track = instrument.pixel()
        brightness = instrument.uk_brightness(dn) + brightness_gain * (
            1.0 if dn == "D" else 0.6
        )
        brightness = min(brightness, 505.0)  # MODIS band 21 saturates
        t31 = instrument.t31(lat, local_day.month, dn, dryness)
        t31 = min(t31, brightness - 1)
        detections.append(
            {
                "latitude": round(lat, 4),
                "longitude": round(lon, 4),
                "brightness": round(brightness, 1),
                "scan": scan,
                "track": track,
                "acq_date": when.date().isoformat(),
                "acq_time": when.strftime("%H%M"),
                "satellite": satellite,
                "instrument": "MODIS",
                "confidence": instrument.conf(brightness, dn),
                "version": "6.03",
                "bright_t31": round(t31, 1),
                "frp": round(instrument.frp(brightness, t31, scan, track), 1),
                "daynight": dn,
                "type": kind,
                "_sort": when,
            }
        )

    def pick_day(year: int, month: int, human: float) -> date:
        days = month_days(year, month)
        w = np.array([(1 - human) + human * weekday[d.weekday()] for d in days])
        return days[rng.choice(len(days), p=w / w.sum())]

    yearly_fire_total = fire_base.sum()
    yearly_crop_total = crop_base.sum()
    seq = Counter()

    for year in range(FIRST_YEAR, LAST_DAY.year + 1):
        for month in range(1, 13):
            if date(year, month, 1) > LAST_DAY:
                break

            # True fires: each burns, is seen, and may be recorded.
            multiplier = boost(year, month)[region_index]
            weights = fire_base[:, month - 1] * multiplier
            n = rng.poisson(TRUE_FIRES_PER_YEAR * weights.sum() / yearly_fire_total)
            for i in rng.choice(len(cells), size=n, p=weights / weights.sum()):
                c = cls[i]
                dryness = DRYNESS[c]
                name, recorded_share = regions[i]
                boreal = c in ("Dfc", "Dfd", "ET") or c.startswith("Dw")
                human = HUMAN_SHARE_BOREAL if boreal else HUMAN_SHARE
                start = pick_day(year, month, human)
                notable_now = multiplier[i] / yearly[year][region_index[i]] > 1

                f_lat = lat[i] + rng.uniform(-CELL_DEG / 2, CELL_DEG / 2)
                f_lon = lon[i] + rng.uniform(-CELL_DEG / 2, CELL_DEG / 2)
                median_km, spread, heat = regime(c)
                if notable_now:
                    median_km *= NOTABLE_SIZE_FACTOR
                radius_km = float(
                    np.clip(rng.lognormal(math.log(median_km), spread), 0.2, 60)
                )
                days = int(
                    np.clip(
                        round(
                            rng.lognormal(
                                math.log(1.5 + 1.2 * radius_km**0.7), 0.4
                            )
                        ),
                        1,
                        45,
                    )
                )

                # Recorded? Big fires almost always are.
                p = 1 - (1 - recorded_share) ** (0.5 + radius_km)
                if rng.random() < p:
                    rec_km = radius_km * rng.lognormal(0, 0.15)
                    # Some dry-country fires are logged early and then escape
                    # far past the size on record.
                    if dryness >= 0.5 and rng.random() < 0.07:
                        rec_km = radius_km * rng.uniform(0.2, 0.5)
                        stats["fires that escaped their record"] += 1
                    r_lat, r_lon = offset(
                        f_lat, f_lon, rng.uniform(0, 0.15) * radius_km,
                        rng.uniform(0, 2 * math.pi),
                    )  # fmt: skip
                    rec_day = start + timedelta(days=int(rng.choice([-1, 0, 0, 0, 1])))
                    if rec_day > LAST_DAY or rec_day.year < FIRST_YEAR:
                        rec_day = start
                    seq[name, rec_day.year] += 1
                    wildfires.append(
                        {
                            "name": f"{name} {rec_day.year} #{seq[name, rec_day.year]:03d}",
                            "latitude": round(r_lat, 4),
                            "longitude": round(r_lon, 4),
                            "date": rec_day.isoformat(),
                            "radius_m": max(100, int(round(rec_km * 10)) * 100),
                        }
                    )
                else:
                    stats["unrecorded fires"] += 1

                # Detections over the burn: the front grows from the middle,
                # busiest a third of the way through.
                n_det = min(rng.poisson(0.5 + 2 * radius_km**0.9) + 1, 80)
                gain_mean = heat * (1 + 0.3 * math.log1p(radius_km))
                for _ in range(n_det):
                    d = min(int(rng.triangular(0, days / 3, days)), days - 1)
                    local_day = start + timedelta(days=d)
                    if local_day > LAST_DAY:
                        continue
                    front_km = radius_km * math.sqrt((d + 1) / days)
                    if dryness >= 0.5 and rng.random() < 0.04:
                        # A spot fire thrown ahead by the wind.
                        dist = radius_km + rng.exponential(8 * dryness)
                        stats["spot fire detections"] += 1
                    else:
                        dist = front_km * rng.uniform(0.5, 1.0)
                    d_lat, d_lon = offset(
                        f_lat, f_lon, dist, rng.uniform(0, 2 * math.pi)
                    )
                    gain = gain_mean * rng.gamma(1.2, 1 / 1.2) * rng.uniform(0.5, 1)
                    detect(d_lat, d_lon, local_day, gain, dryness)

            # Crop and pasture burns: small, brief, never recorded.
            weights = crop_base[:, month - 1] * boost(year, month)[region_index] ** 0.3
            n = rng.poisson(CROP_BURNS_PER_YEAR * weights.sum() / yearly_crop_total)
            for i in rng.choice(len(cells), size=n, p=weights / weights.sum()):
                day = pick_day(year, month, 1.0)
                c_lat = lat[i] + rng.uniform(-CELL_DEG / 2, CELL_DEG / 2)
                c_lon = lon[i] + rng.uniform(-CELL_DEG / 2, CELL_DEG / 2)
                for _ in range(rng.integers(1, 3)):
                    gain = 6 * rng.gamma(1.2, 1 / 1.2)
                    detect(c_lat, c_lon, day, gain, DRYNESS.get(cls[i], 0.3))
                    stats["crop burn detections"] += 1

    # Static industrial sources: the UK's real sites and readings, and the
    # world's big flares dressed in UK readings.
    uk_static = [
        (r["lat"], r["lon"], r)
        for r in instrument.static_rows
        if FIRST_YEAR <= r["date"].year and r["date"] <= LAST_DAY
    ]
    for s_lat, s_lon, r in uk_static:
        detections.append(
            {
                "latitude": s_lat,
                "longitude": s_lon,
                "brightness": r["brightness"],
                "scan": r["scan"],
                "track": r["track"],
                "acq_date": r["date"].isoformat(),
                "acq_time": f"{r['time']:04d}",
                "satellite": r["satellite"],
                "instrument": "MODIS",
                "confidence": r["confidence"],
                "version": "6.03",
                "bright_t31": r["t31"],
                "frp": r["frp"],
                "daynight": r["daynight"],
                "type": 2,
                "_sort": datetime.combine(r["date"], datetime.min.time())
                + timedelta(hours=r["time"] // 100, minutes=r["time"] % 100),
            }
        )
    span = (LAST_DAY - date(FIRST_YEAR, 1, 1)).days
    for s_lat, s_lon in GLOBAL_STATIC_SITES:
        for _ in range(rng.poisson(STATIC_DETECTIONS_PER_YEAR * span / 365.25)):
            day = date(FIRST_YEAR, 1, 1) + timedelta(days=int(rng.integers(span + 1)))
            row = instrument.static_rows[rng.integers(len(instrument.static_rows))]
            gain = row["brightness"] - instrument.uk_brightness(row["daynight"])
            p_lat, p_lon = offset(s_lat, s_lon, rng.uniform(0, 1.5), rng.uniform(0, 6.3))
            detect(p_lat, p_lon, day, max(gain, 0) * 0.5, 0.9, kind=2)
    stats["static source detections"] = sum(d["type"] == 2 for d in detections)

    wildfires.sort(key=lambda f: (f["date"], f["name"]))
    detections.sort(key=lambda d: d["_sort"])

    with (DATA / "wildfires.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f, ["name", "latitude", "longitude", "date", "radius_m"], lineterminator="\n"
        )
        w.writeheader()
        w.writerows(wildfires)
    fields = [k for k in detections[0] if not k.startswith("_")]
    with (DATA / "satellite_detections.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fields, extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        w.writerows(detections)

    print(f"{len(wildfires)} wildfires, {len(detections)} detections")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
