# Hindcast pile-up maps: average wind of the training seasons (predicted) vs the target season's wind (actual).
# Written by B (Irina) for C; reuses C's building blocks from build.py without changing them.
#
# Usage: python geo/hindcast.py [region_id ...]   (default: all regions)
# Writes geo/output/{region}/hindcast/pileup_{t}_{T}_{predicted|actual}.geojson and sightings_{T}.geojson.
import json
import sys

import geopandas as gpd
import numpy as np
import osmnx as ox
import pandas as pd
from rasterio.enums import MergeAlg

from build import BARRIER_TAGS, DATA, OPEN_LAND_TAGS, OUT, STEPS, THRESHOLDS, Grid, deposit, sightings, source_weight

# Same target seasons as backend/forecast.py.
TARGETS = [2023, 2024]


def season_of(time):
    # Growth season of each wind hour: Nov–Dec -> same year, Jan–Apr -> previous year.
    return time.dt.year - (time.dt.month <= 4)


def direction_hours(wind, t):
    # Table: rows = seasons, 8 columns = direction the wind blows TOWARD (0 = N, 1 = NE, 2 = E, ...),
    # values = number of hours with speed >= t m/s.
    time = pd.to_datetime(wind.time)
    season = season_of(time)
    # Keep only complete seasons (all 6 months Nov–Apr present). The real wind.csv starts on 2001-01-01,
    # so season 2000 has only Jan–Apr and would make the "average season" look calmer than it is.
    complete = time.dt.month.groupby(season).transform("nunique") == 6
    season, wind = season[complete], wind[complete]
    fast = wind.speed_ms >= t
    # 45° bins: round(dir / 45) gives 0..8, and % 8 folds 360° back onto north.
    bins = np.round(wind.dir_deg[fast] / 45).astype(int) % 8
    # reindex keeps seasons/directions with zero windy hours as 0 instead of dropping them.
    return pd.crosstab(season[fast], bins).reindex(index=np.unique(season), columns=range(8), fill_value=0)


def maps(per_dir, hours, target):
    # per_dir[d] = where tumbleweeds pile up per hour of wind toward direction d (from C's deposit()).
    # Predicted uses the AVERAGE hours of all seasons before target (what we'd expect, knowing only the past);
    # actual uses the target season's real hours.
    train = hours.loc[:target - 1]
    assert len(train), f"wind.csv has no seasons before {target}"
    predicted = np.tensordot(train.mean().to_numpy(), per_dir, axes=1)
    actual = np.tensordot(hours.loc[target].to_numpy(), per_dir, axes=1)
    # Same divisor for both, so equal colours mean equal risk when the two maps sit side by side.
    top = max(predicted.max(), actual.max())
    return (predicted / top, actual / top) if top else (predicted, actual)


def build(region):
    # Write hindcast pile-up maps and target-season sightings for one region.
    rid, bbox = region["id"], region["bbox"]
    # Same steps as C's build(): 250 m grid, sightings + open land -> sources, buildings/fences -> barriers.
    grid = Grid(bbox)
    occ = sightings(rid, bbox)
    counts = grid.burn(gpd.points_from_xy(occ.lon, occ.lat), MergeAlg.add)
    source = source_weight(counts, grid.burn(ox.features_from_bbox(bbox, OPEN_LAND_TAGS).geometry))
    barrier = grid.burn(ox.features_from_bbox(bbox, BARRIER_TAGS).geometry)
    # Pile-up pattern for each of the 8 wind directions (computed once, reused for every season).
    per_dir = np.stack([deposit(source, barrier, dr, dc) for dr, dc in STEPS])
    wind = pd.read_csv(DATA / rid / "wind.csv")
    out = OUT / rid / "hindcast"
    for t in THRESHOLDS:
        hours = direction_hours(wind, t)
        for target in TARGETS:
            for kind, risk in zip(["predicted", "actual"], maps(per_dir, hours, target)):
                # `hours` on the map: windy hours in the season (average per season for predicted).
                n = hours.loc[:target - 1].sum(axis=1).mean() if kind == "predicted" else hours.loc[target].sum()
                grid.to_geojson(risk, "risk", out / f"pileup_{t}_{target}_{kind}.geojson", hours=int(round(n)))
    for target in TARGETS:
        # Sightings recorded in the target year, to check where plants really showed up.
        seen = occ[occ.year == target]
        (OUT / rid / f"sightings_{target}.geojson").write_text(
            gpd.GeoDataFrame(seen[["id", "source", "quality", "taxon"]],
                             geometry=gpd.points_from_xy(seen.lon, seen.lat), crs=4326).to_json(drop_id=True))
        print(f"{rid} {target}: {len(seen)} sightings")


if __name__ == "__main__":
    for region in json.loads((DATA / "regions.json").read_text()):
        if len(sys.argv) == 1 or region["id"] in sys.argv[1:]:
            build(region)
