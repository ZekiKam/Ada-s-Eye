"""How dry a place is, from its Köppen-Geiger climate class.

The grid is Kottek et al. (2006), "World Map of the Köppen-Geiger climate
classification updated", Meteorologische Zeitschrift 15, 259-263: one class per
0.5 degree land cell, as published at koeppen-geiger.vu-wien.ac.at.
"""

import gzip
import logging
import math
from pathlib import Path

logger = logging.getLogger(__name__)

CELL_DEG = 0.5

# How far each climate dries out, from 0 (never) to 1 (desert).
DRYNESS_BY_CLASS = {
    **dict.fromkeys(["BWh", "BWk"], 1.0),  # desert
    **dict.fromkeys(["BSh", "BSk"], 0.9),  # steppe
    **dict.fromkeys(["Csa", "Csb", "Csc"], 0.8),  # Mediterranean: dry summers
    **dict.fromkeys(["Aw", "As"], 0.7),  # savanna: long dry season
    # A dry season in winter or summer.
    **dict.fromkeys(
        ["Cwa", "Cwb", "Cwc", "Dsa", "Dsb", "Dsc", "Dwa", "Dwb", "Dwc", "Dwd"], 0.5
    ),
    # Rain all year.
    **dict.fromkeys(["Am", "Cfa", "Cfb", "Cfc", "Dfa", "Dfb", "Dfc", "Dfd"], 0.3),
    "Af": 0.1,  # rainforest
    **dict.fromkeys(["ET", "EF"], 0.0),  # tundra, ice
}


def _cell(lon: float, lat: float) -> tuple[int, int]:
    return math.floor((lat + 90) / CELL_DEG), math.floor((lon + 180) / CELL_DEG)


class Dryness:
    def __init__(self, cells: dict[tuple[int, int], float]):
        self._cells = cells

    def at(self, lon: float, lat: float) -> float:
        """Dryness of the cell holding this point. A point just off the coast
        takes the mean of the land cells around it, and 0 if there are none."""
        row, col = _cell(lon, lat)
        if (row, col) in self._cells:
            return self._cells[row, col]
        cols = 360 / CELL_DEG
        around = [
            self._cells[key]
            for dr in (-1, 0, 1)
            for dc in (-1, 0, 1)
            if (key := (row + dr, int((col + dc) % cols))) in self._cells
        ]
        return sum(around) / len(around) if around else 0.0


def load_dryness(path: Path) -> Dryness:
    """Gzipped Kottek grid: a header, then `lat lon class` per line."""
    cells = {}
    try:
        with gzip.open(path, "rt", encoding="utf-8") as f:
            next(f)
            for line in f:
                lat, lon, cls = line.split()
                if cls in DRYNESS_BY_CLASS:
                    cells[_cell(float(lon), float(lat))] = DRYNESS_BY_CLASS[cls]
    except OSError as e:
        logger.warning("No climate grid (%s); every place counts as not dry", e)
    return Dryness(cells)
