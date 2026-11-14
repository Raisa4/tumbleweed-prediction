# Tumbleweed Trend Detective API: regions, trends, index, backtest, forecasts and map layers.
# Run with: uvicorn main:app --reload   (then open http://localhost:8000/docs)
import json
from pathlib import Path
from typing import Literal

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from forecast import TARGETS
from stats import SIGN, UNITS, analyze, backtest, conditions_index, seasons

# Paths are resolved from this file, so the server works no matter where it is started from.
ROOT = Path(__file__).resolve().parent.parent
# data/ = A's yearly numbers, C's events, our frozen forecasts. geo/output/ = C's map layers.
DATA, GEO = ROOT / "data", ROOT / "geo" / "output"
# Wind thresholds (m/s) for which a pile-up layer exists (the slider on the website).
# Low on purpose: MERRA-2 is a ~50 km average, so it rarely reaches 14–16 m/s even when gusts do.
THRESHOLDS = {4, 6, 8, 10, 12}

app = FastAPI(title="Tumbleweed Trend Detective")
# The Vite dev server (frontend) runs on port 5173; without CORS the browser would block its requests to us.
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["GET"])


# ---------- helpers ----------

def regions():
    # Region list, re-read on every request so data updates show up without a restart.
    return json.loads((DATA / "regions.json").read_text())


def region_dir(base, region):
    # Folder for a known region id; 404 otherwise (this also blocks paths like '../').
    if region not in {r["id"] for r in regions()}:
        raise HTTPException(404, f"unknown region {region!r}")
    return base / region


def check_threshold(threshold):
    # Only the 5 wind thresholds that have a map file are allowed; anything else -> error 422.
    if threshold not in THRESHOLDS:
        raise HTTPException(422, f"threshold must be one of {sorted(THRESHOLDS)}")


def check_target(target):
    # Only the forecast target seasons (2023, 2024) are allowed.
    if target not in TARGETS:
        raise HTTPException(422, f"target must be one of {TARGETS}")


def annual(region):
    # A's yearly table for a region: columns year, variable, value (read fresh every request).
    return pd.read_csv(region_dir(DATA, region) / "annual.csv")


def region_index(region):
    # Tumbleweed Conditions Index per growth season (see stats.py).
    return conditions_index(seasons(annual(region)))


# ---------- endpoints ----------

@app.get("/regions")
def get_regions():
    # The 3 regions with their name and bounding box.
    return regions()


@app.get("/layers/{region}/sources.geojson")
def sources(region: str):
    # C's seed-source map, sent as the file it is.
    return FileResponse(region_dir(GEO, region) / "sources.geojson", media_type="application/geo+json")


@app.get("/layers/{region}/pileup.geojson")
def pileup(region: str, threshold: int):
    # C's pile-up map for one wind threshold.
    check_threshold(threshold)
    return FileResponse(region_dir(GEO, region) / f"pileup_{threshold}.geojson", media_type="application/geo+json")


@app.get("/trend")
def trend(region: str, var: str):
    # Trend + significance for one variable, e.g. /trend?region=victorville&var=windy_days
    if var not in SIGN.index:
        raise HTTPException(422, f"var must be one of {list(SIGN.index)}")
    # Keep only this variable's rows, oldest year first.
    series = annual(region).query("variable == @var").sort_values("year")
    # A known variable that A hasn't delivered yet (e.g. peak_ndvi_anom) -> clear 404 instead of a crash.
    if series.empty:
        raise HTTPException(404, f"{var} is not available yet for {region}")
    return {"region": region, "var": var, **analyze(series.year, series.value, UNITS[var])}


@app.get("/index")
def index(region: str):
    # Same answer shape as /trend, but for the combined index (years = growth seasons).
    idx = region_index(region)
    return {"region": region, "var": "index", **analyze(idx.index, idx.values, UNITS["index"])}


@app.get("/backtest")
def get_backtest(region: str):
    # Was the index high in the seasons before the real, news-reported pile-ups?
    return backtest(region_index(region), pd.read_csv(region_dir(DATA, region) / "events.csv"))


@app.get("/forecast")
def forecast(region: str, target: int):
    # Frozen prediction-vs-reality file written by forecast.py.
    check_target(target)
    return FileResponse(region_dir(DATA, region) / f"forecast_{target}.json", media_type="application/json")


@app.get("/layers/{region}/hindcast.geojson")
def hindcast_layer(region: str, threshold: int, target: int, kind: Literal["predicted", "actual"]):
    # Predicted or actual pile-up map for a target season (written by geo/hindcast.py).
    # Literal makes FastAPI reject any kind other than "predicted"/"actual" with error 422.
    check_threshold(threshold)
    check_target(target)
    path = region_dir(GEO, region) / "hindcast" / f"pileup_{threshold}_{target}_{kind}.geojson"
    return FileResponse(path, media_type="application/geo+json")


@app.get("/layers/{region}/sightings.geojson")
def target_sightings(region: str, target: int):
    # Tumbleweed sightings (GBIF + iNaturalist) observed in the target season, drawn on top of the maps.
    check_target(target)
    return FileResponse(region_dir(GEO, region) / f"sightings_{target}.geojson", media_type="application/geo+json")
