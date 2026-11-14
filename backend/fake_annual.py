"""Write placeholder data/{region}/annual.csv until Person A's real file lands (never overwrites)."""
import json
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data"
YEARS = np.arange(2001, 2026)
# Rough per-region levels so the charts look plausible: spring rain (mm), autumn soil (kg/m²), windy days, open land.
LEVELS = {"salt_lake_valley": (150, 18, 10, 0.40), "victorville": (25, 8, 6, 0.70), "tri_cities_wa": (55, 14, 12, 0.50)}

if __name__ == "__main__":
    rng = np.random.default_rng(1)
    for region in json.loads((DATA / "regions.json").read_text()):
        path = DATA / region["id"] / "annual.csv"
        if path.exists():
            continue
        rain, soil, windy, barren = LEVELS[region["id"]]
        t = YEARS - YEARS[0]
        # Built-in trends so the UI shows both outcomes: windy days rise, soil dries; rain and greenness are pure noise.
        values = {"spring_precip": rain * rng.gamma(8, 1 / 8, len(t)),
                  "peak_ndvi_anom": rng.normal(0, 0.03, len(t)),
                  "autumn_soilm": soil - 0.08 * t + rng.normal(0, 1.5, len(t)),
                  "windy_days": rng.poisson(windy + 0.25 * t),
                  "barren_frac": barren + 0.002 * t + rng.normal(0, 0.01, len(t))}
        values["peak_ndvi_anom"] -= values["peak_ndvi_anom"].mean()
        pd.DataFrame([(y, var, round(float(v), 4)) for var, vs in values.items() for y, v in zip(YEARS, vs)],
                     columns=["year", "variable", "value"]).to_csv(path, index=False)
