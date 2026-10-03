# backend-compsoc

Compares recorded wildfires with NASA satellite fire detections and flags **anomalies**: hot detections that no recorded wildfire explains.

## Data

Two CSV files, read once at startup from `data/` (override with `DATA_DIR`). `data/` holds a small sample set.

**`wildfires.csv`**: real, recorded events. Extra columns (like `name`) are ignored.

| column | meaning |
| --- | --- |
| `latitude`, `longitude` | centre of the fire |
| `date` | `YYYY-MM-DD` |
| `radius_m` | footprint radius in metres |

**`satellite_detections.csv`**: a [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/download/) export, used as is. Required columns are `latitude`, `longitude`, `brightness` (or `bright_ti4` for VIIRS), `acq_date`, `acq_time` (HHMM UTC) and `confidence` (0–100, or `l`/`n`/`h` for VIIRS). `scan` and `track` set the pixel radius. Other columns are ignored.

Rows that fail to parse are logged and skipped.

## Anomaly rule

A detection is an anomaly when both of these are true:

1. its `brightness` is at least `BRIGHTNESS_THRESHOLD` (default 340 K), and
2. no wildfire is within the fire's `radius_m` plus `MATCH_DISTANCE_KM` (default 10 km) of it, dated within `MATCH_DAYS` (default 1) days of it.

Settings come from environment variables or `.env`. They are `DATA_DIR`, `WILDFIRES_FILE`, `DETECTIONS_FILE`, `BRIGHTNESS_THRESHOLD`, `MATCH_DISTANCE_KM`, `MATCH_DAYS` and `QUERY_RADIUS_KM`.

## API

- `GET /api/get_all_points`: every recorded wildfire.
- `GET /api/get_anomalies`: every anomaly, with brightness and satellite confidence.
- `GET /api/request_anomaly?longitude=&latitude=&year=`: the most confident anomaly within `QUERY_RADIUS_KM` (default 50 km) of the spot in that year. If there is none, it returns confidence 0 and the search radius.

## Run

```sh
uv sync
cd src
uv run fastapi dev main.py --port 8001
```

Port 8001 matches `BACKEND_URL` in the frontend's `.dev.vars`.
