"""Tumbleweed Trend Detective API: regions, trends, index, backtest and map layers."""
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# Paths are resolved from this file, so the server works no matter where it is started from.
ROOT = Path(__file__).resolve().parent.parent
DATA, GEO = ROOT / "data", ROOT / "geo" / "output"
# Wind thresholds (m/s) for which Person C exports a pile-up layer.
THRESHOLDS = {8, 10, 12, 14, 16}

app = FastAPI(title="Tumbleweed Trend Detective")
# The Vite dev server (frontend) runs on port 5173 and calls us from the browser.
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["GET"])


def regions():
    """Region list, re-read on every request so data updates show up without a restart."""
    return json.loads((DATA / "regions.json").read_text())


def region_dir(base, region):
    """Folder for a known region id; 404 otherwise (this also blocks paths like '../')."""
    if region not in {r["id"] for r in regions()}:
        raise HTTPException(404, f"unknown region {region!r}")
    return base / region


@app.get("/regions")
def get_regions():
    return regions()


@app.get("/layers/{region}/sources.geojson")
def sources(region: str):
    return FileResponse(region_dir(GEO, region) / "sources.geojson", media_type="application/geo+json")


@app.get("/layers/{region}/pileup.geojson")
def pileup(region: str, threshold: int):
    if threshold not in THRESHOLDS:
        raise HTTPException(422, f"threshold must be one of {sorted(THRESHOLDS)}")
    return FileResponse(region_dir(GEO, region) / f"pileup_{threshold}.geojson", media_type="application/geo+json")
