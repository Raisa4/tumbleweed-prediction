"""Write placeholder data/{region}/wind.csv (blowing mostly east) until Person A's MERRA-2 file lands."""
import json
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data"

if __name__ == "__main__":
    rng = np.random.default_rng(0)
    for region in json.loads((DATA / "regions.json").read_text()):
        path = DATA / region["id"] / "wind.csv"
        if path.exists():
            continue
        time = pd.date_range("2023-11-01", "2025-04-30 23:00", freq="h")
        time = time[(time.month >= 11) | (time.month <= 4)]
        pd.DataFrame({"time": time.strftime("%Y-%m-%dT%H:%M"),
                      "speed_ms": (5.5 * rng.weibull(2, len(time))).round(2),
                      "dir_deg": (np.degrees(rng.vonmises(np.pi / 2, 2, len(time))) % 360).round(1)}
                     ).to_csv(path, index=False)
