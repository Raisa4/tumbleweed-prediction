"""Build tumbleweed seed-source and wind pile-up layers per region.

Usage: python geo/build.py [region_id ...]   (default: all regions)
"""
import json
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import osmnx as ox
import pandas as pd
import requests
import shapely
from rasterio.enums import MergeAlg
from rasterio.features import rasterize
from rasterio.transform import from_origin
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parent.parent
DATA, RAW, OUT = ROOT / "data", ROOT / "data" / "raw" / "geo", ROOT / "geo" / "output"
CELL_M = 250
REACH_M = 4000
DENSITY_SIGMA_CELLS = 2
MAX_UNCERTAINTY_M = 1000
EXPORT_MIN = 0.05
THRESHOLDS = [8, 10, 12, 14, 16]
GBIF = "https://api.gbif.org/v1"
GBIF_NAMES = ["Salsola tragus", "Salsola kali", "Salsola kali subsp. tragus", "Kali tragus",
              "Salsola iberica", "Bassia scoparia", "Kochia scoparia"]
OPEN_LAND_TAGS = {"landuse": ["farmland", "brownfield", "greenfield", "construction", "meadow"],
                  "natural": ["scrub", "grassland", "heath"]}
BARRIER_TAGS = {"building": True, "barrier": ["fence", "wall"],
                "highway": ["motorway", "trunk", "primary"]}
# Wind direction TOWARD, 8 bins of 45 deg starting at north; (row, col) step on a north-up grid.
STEPS = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]

ox.settings.cache_folder = RAW / "osmnx"


class Grid:
    """250 m north-up grid over a region bbox, in the region's UTM zone."""

    def __init__(self, bbox):
        self.crs = gpd.GeoSeries([shapely.box(*bbox)], crs=4326).estimate_utm_crs()
        minx, miny, maxx, maxy = gpd.GeoSeries([shapely.box(*bbox)], crs=4326).to_crs(self.crs).total_bounds
        self.x0, self.y0 = minx, maxy
        self.shape = (int(np.ceil((maxy - miny) / CELL_M)), int(np.ceil((maxx - minx) / CELL_M)))
        self.transform = from_origin(minx, maxy, CELL_M, CELL_M)

    def burn(self, geoms, merge_alg=MergeAlg.replace):
        """Rasterize geometries (EPSG:4326) onto the grid; counts with MergeAlg.add."""
        geoms = gpd.GeoSeries(geoms, crs=4326).to_crs(self.crs)
        return rasterize(((g, 1) for g in geoms), out_shape=self.shape, transform=self.transform,
                         all_touched=True, merge_alg=merge_alg, dtype="float64")

    def to_geojson(self, values, name, path, **props):
        """Write cells with value > EXPORT_MIN as WGS84 polygons with property `name` (+ constant props)."""
        rows, cols = np.nonzero(values > EXPORT_MIN)
        x, y = self.x0 + cols * CELL_M, self.y0 - rows * CELL_M
        gdf = gpd.GeoDataFrame({name: values[rows, cols].round(3), **props},
                               geometry=shapely.box(x, y - CELL_M, x + CELL_M, y), crs=self.crs).to_crs(4326)
        gdf.geometry = shapely.set_precision(gdf.geometry.values, 1e-5)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(gdf.to_json(drop_id=True))


def gbif_occurrences(region_id, bbox):
    """All GBIF occurrences of the tumbleweed taxa in bbox, cached to data/raw."""
    cache = RAW / f"{region_id}_gbif.csv"
    if cache.exists():
        return pd.read_csv(cache)
    keys = set()
    for name in GBIF_NAMES:
        m = requests.get(f"{GBIF}/species/match", params={"name": name, "kingdom": "Plantae"}).json()
        keys.add(m.get("acceptedUsageKey", m["usageKey"]))
    w, s, e, n = bbox
    params = {"taxonKey": sorted(keys), "decimalLongitude": f"{w},{e}", "decimalLatitude": f"{s},{n}",
              "hasCoordinate": "true", "hasGeospatialIssue": "false", "limit": 300}
    records, offset = [], 0
    while True:
        r = requests.get(f"{GBIF}/occurrence/search", params={**params, "offset": offset})
        r.raise_for_status()
        page = r.json()
        records += page["results"]
        if page["endOfRecords"]:
            break
        offset += params["limit"]
    df = pd.DataFrame(records, columns=["gbifID", "species", "decimalLatitude", "decimalLongitude",
                                        "coordinateUncertaintyInMeters", "year", "basisOfRecord"])
    df = df.drop_duplicates("gbifID")
    df = df[~(df.coordinateUncertaintyInMeters > MAX_UNCERTAINTY_M)]
    RAW.mkdir(parents=True, exist_ok=True)
    df.to_csv(cache, index=False)
    return df


def source_weight(sightings, open_land):
    """0-1 seed-source weight: mean of normalized smoothed sighting density and open-land flag."""
    density = gaussian_filter(sightings, DENSITY_SIGMA_CELLS)
    density = density / density.max() if density.any() else density
    return (density + open_land) / 2


def shift(a, dr, dc):
    """Shift array by (dr, dc) cells, filling with zeros (no wrap-around)."""
    out = np.zeros_like(a)
    h, w = a.shape
    out[max(dr, 0):h + min(dr, 0), max(dc, 0):w + min(dc, 0)] = a[max(-dr, 0):h + min(-dr, 0), max(-dc, 0):w + min(-dc, 0)]
    return out


def deposit(source, barrier, dr, dc):
    """Push source weight (dr, dc) per step up to REACH_M; barrier cells catch all that reaches them."""
    steps = round(REACH_M / (CELL_M * np.hypot(dr, dc)))
    moving, caught = source.copy(), np.zeros_like(source)
    for _ in range(steps):
        moving = shift(moving, dr, dc)
        caught += moving * barrier
        moving *= 1 - barrier
    return caught


def pileup(per_dir, wind, t):
    """0-1 pile-up risk from hours with speed >= t, each direction weighted by its hour count."""
    fast = wind[wind.speed_ms >= t]
    raw = np.tensordot(np.bincount(np.round(fast.dir_deg / 45).astype(int) % 8, minlength=8), per_dir, axes=1)
    return raw / raw.max() if raw.any() else raw


def build(region):
    """Write sources.geojson and pileup_{t}.geojson for one region."""
    rid, bbox = region["id"], region["bbox"]
    grid = Grid(bbox)
    occ = gbif_occurrences(rid, bbox)
    sightings = grid.burn(gpd.points_from_xy(occ.decimalLongitude, occ.decimalLatitude), MergeAlg.add)
    open_land = grid.burn(ox.features_from_bbox(bbox, OPEN_LAND_TAGS).geometry)
    barrier = grid.burn(ox.features_from_bbox(bbox, BARRIER_TAGS).geometry)
    source = source_weight(sightings, open_land)
    wind = pd.read_csv(DATA / rid / "wind.csv")
    out = OUT / rid
    grid.to_geojson(source, "weight", out / "sources.geojson")
    per_dir = np.stack([deposit(source, barrier, dr, dc) for dr, dc in STEPS])
    for t in THRESHOLDS:
        risk, hours = pileup(per_dir, wind, t), int((wind.speed_ms >= t).sum())
        grid.to_geojson(risk, "risk", out / f"pileup_{t}.geojson", hours=hours)
        print(f"{rid} t={t}: {hours} h, {(risk > EXPORT_MIN).sum()} cells")
    print(f"{rid}: grid {grid.shape}, {len(occ)} GBIF records, {int(open_land.sum())} open cells, "
          f"{int(barrier.sum())} barrier cells, {(source > EXPORT_MIN).sum()} source cells")


if __name__ == "__main__":
    regions = json.loads((DATA / "regions.json").read_text())
    for region in regions:
        if len(sys.argv) == 1 or region["id"] in sys.argv[1:]:
            build(region)
