"""Write fake API responses (same JSON shape as backend, section 7) to public/fixtures."""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import norm

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "fixtures"
YEARS = np.arange(2001, 2026)
# variable: (mean, sd, slope per yr, unit)
VARS = {
    "spring_precip": (90, 25, 0.6, "mm"),
    "peak_ndvi_anom": (0, 0.03, 0.0008, "NDVI"),
    "autumn_soilm": (14, 2, -0.09, "kg/m²"),
    "windy_days": (18, 4, 0.25, "days"),
    "barren_frac": (0.55, 0.01, 0.0006, ""),
}


def analyze(years, values, unit):
    """Mann-Kendall + Sen's slope with 95% CI, same shape as backend stats.analyze."""
    n = len(values)
    i, j = np.triu_indices(n, 1)
    s = np.sign(values[j] - values[i]).sum()
    var = n * (n - 1) * (2 * n + 5) / 18
    z = (s - np.sign(s)) / np.sqrt(var)
    p = float(2 * norm.sf(abs(z)))
    slopes = np.sort((values[j] - values[i]) / (years[j] - years[i]))
    c = norm.ppf(0.975) * np.sqrt(var)
    lo, hi = int((len(slopes) - c) / 2), int((len(slopes) + c) / 2)
    slope = float(np.median(slopes))
    sig = p < 0.05
    trend = "no trend" if not sig else ("increasing" if z > 0 else "decreasing")
    rate = f"{abs(slope):.3g} {unit}/yr".replace(" /yr", "/yr")
    ptxt = "p<0.001" if p < 0.001 else f"p={p:.3f}"
    verdict = (f"{trend.capitalize()} by {rate} — significant ({ptxt})" if sig
               else f"No significant trend ({ptxt}) — the change could be random year-to-year noise")
    return {"years": years.tolist(), "values": np.round(values, 4).tolist(), "slope": slope,
            "ci_low": float(slopes[lo]), "ci_high": float(slopes[min(hi, len(slopes) - 1)]), "p": p,
            "trend": trend, "significant": bool(sig), "verdict": verdict}


def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj))


regions = json.loads((ROOT / "data" / "regions.json").read_text())
write(OUT / "regions.json", regions)
for k, reg in enumerate(regions):
    rng = np.random.default_rng(k)
    rid = reg["id"]
    table = pd.DataFrame({v: m + sl * (k + 1) / 2 * (YEARS - 2001) + rng.normal(0, sd, len(YEARS))
                          for v, (m, sd, sl, _) in VARS.items()}, index=YEARS)
    for v, (*_, unit) in VARS.items():
        write(OUT / "trend" / rid / f"{v}.json", {"region": rid, "var": v, **analyze(YEARS, table[v].values, unit)})
    z = (table - table.mean()) / table.std()
    z["autumn_soilm"] *= -1
    index = z.mean(axis=1)
    write(OUT / "index" / f"{rid}.json", {"region": rid, "var": "index", **analyze(YEARS, index.values, "")})
    events = pd.read_csv(ROOT / "data" / rid / "events.csv", parse_dates=["date"])
    season = events.date.dt.year - (events.date.dt.month < 7)
    ranks = index.rank(ascending=False).astype(int)
    write(OUT / "backtest" / f"{rid}.json", [
        {"date": e.date.strftime("%Y-%m-%d"), "place": e.place, "lat": e.lat, "lon": e.lon,
         "source_url": e.source_url, "season": int(s), "index_value": round(float(index[s]), 3),
         "rank": int(ranks[s]), "of_years": len(YEARS)}
        for e, s in zip(events.itertuples(), season)])
