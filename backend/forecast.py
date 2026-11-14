# Hindcast ("prediction vs reality"): rolling-origin validation of three forecasters,
# then frozen predictions for the target seasons 2023 and 2024.
#
# Usage: python forecast.py [model ...]   (default: mean sen tabpfn; `python forecast.py mean sen` runs offline)
# Writes data/{region}/forecast_{T}.json for every region and target. Rerun it when annual.csv changes.
import json
import os
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import t as student_t, theilslopes
from tabpfn_client import TabPFNRegressor, set_access_token

from stats import SIGN, seasons

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
# Validation starts once 10 seasons are known: train 2001–2010 -> predict 2011, then 2001–2011 -> 2012, ...
FIRST_TRAIN = 10
# Held-out test seasons: never used to choose a model, only shown at the end.
TARGETS = [2023, 2024]
# The 6 series we forecast: the 5 variables + the combined index.
SERIES = [*SIGN.index, "index"]
# TabPFN version pinned so reruns use the same model.
TABPFN_MODEL = "v3.5_default"


# ---------- the three forecasters ----------
# Each one gets `train` (rows = training seasons, columns = series) and the target season,
# and returns three Series (one value per series): prediction, lower and upper end of the 95% interval.

def mean_forecast(train, target):
    # Baseline: "next season will be like the average season".
    n, mean = len(train), train.mean()
    # 95% prediction interval for ONE new value: mean ± t * std * sqrt(1 + 1/n).
    half = student_t.ppf(0.975, n - 1) * train.std() * np.sqrt(1 + 1 / n)
    return mean, mean - half, mean + half


def sen_forecast(train, target):
    # Trend: extend each series' Sen trend line by one season.
    x, n = train.index.to_numpy(), len(train)
    # Fit a Sen line (slope, intercept) for every column.
    slope, intercept = (pd.Series(v, index=train.columns) for v in zip(*(theilslopes(train[c], x)[:2] for c in train)))
    # Residuals = how far each real value is from its trend line.
    resid = train - (np.outer(x, slope) + intercept.to_numpy())
    # Textbook regression prediction interval shape: wider the further target is from the training years' centre.
    spread = np.sqrt(1 + 1 / n + (target - x.mean()) ** 2 / ((x - x.mean()) ** 2).sum())
    pred, half = intercept + slope * target, student_t.ppf(0.975, n - 2) * resid.std(ddof=2) * spread
    return pred, pred - half, pred + half


def tabpfn_forecast(train, target):
    # TabPFN (pre-trained model for small tables, via Prior Labs' API) on all 6 series in ONE call.
    # Each training row = (series name, season, last season's value) -> this season's value.
    # z-score every series with its training mean/std so rain (mm) and wind (days) share one scale.
    mean, std = train.mean(), train.std()
    z = (train - mean) / std
    # Long format: one row per (season, series) with the value in column y.
    rows = z.rename_axis(index="season", columns="series").stack().rename("y").reset_index()
    # lag = the same series' value one season earlier (the first season has none, so it is dropped).
    rows["lag"] = rows.groupby("series").y.shift()
    rows = rows.dropna()
    # The row to predict: each series at the target season, with its last known value as lag.
    test = pd.DataFrame({"series": z.columns, "season": target, "lag": z.iloc[-1].to_numpy()})
    model = TabPFNRegressor(model_path=TABPFN_MODEL)
    model.fit(rows[["series", "season", "lag"]], rows.y)
    # Median = prediction; 2.5% and 97.5% quantiles = the 95% interval.
    q = model.predict(test, output_type="quantiles", quantiles=[0.5, 0.025, 0.975])
    # Undo the z-score so results are back in mm / days / kg/m².
    return tuple(pd.Series(v, index=z.columns) * std + mean for v in q)


MODELS = {"mean": mean_forecast, "sen": sen_forecast, "tabpfn": tabpfn_forecast}


# ---------- forecasting and validation ----------

def with_index(wide, train_end):
    # Adds the conditions index as a 6th column, z-scored with the TRAINING seasons' mean/std only,
    # so the season we predict can't sneak into its own forecast (no leakage).
    train = wide.loc[:train_end]
    return wide.assign(index=((wide - train.mean()) / train.std() * SIGN).mean(axis=1))


def predict(wide, target, models):
    # One-step forecast of each series for `target`, using only the seasons before it.
    # models maps series -> model name, e.g. {"windy_days": "sen", "spring_precip": "mean", ...}.
    s = with_index(wide, target - 1)
    train = s.loc[:target - 1, SERIES]
    # Run each model that is needed once (TabPFN = one API call for all series).
    runs = {m: MODELS[m](train, target) for m in set(models.values())}
    # pick(k): for every series, take result k (0 = prediction, 1 = low, 2 = high) from that series' model.
    pick = lambda k: [runs[models[n]][k][n] for n in SERIES]
    out = pd.DataFrame({"var": SERIES, "model": [models[n] for n in SERIES], "predicted": pick(0),
                        "pi_low": pick(1), "pi_high": pick(2), "actual": s.loc[target, SERIES].to_numpy()})
    # inside = did the real value fall in the 95% interval? error = how far the prediction was off.
    return out.assign(inside=out.actual.between(out.pi_low, out.pi_high), error=(out.predicted - out.actual).abs())


def validate(wide, models):
    # Every model on every validation season (2011–2022): one row per (season, model, series).
    years = range(wide.index[0] + FIRST_TRAIN, TARGETS[0])
    return pd.concat([predict(wide, t, dict.fromkeys(SERIES, m)).assign(season=t) for t in years for m in models])


def hindcast(wide, target, val):
    # Frozen forecast for one target season, with models chosen and scored on the validation rows `val` only.

    # For each series, choose the model with the smallest average error over 2011–2022.
    chosen = val.groupby(["var", "model"]).error.mean().unstack().idxmin(axis=1)
    # The validation rows of the chosen models, and the mean model's errors to compare against.
    picked = val[val.model == val["var"].map(chosen)].set_index(["season", "var"])
    mean_err = val[val.model == "mean"].set_index(["season", "var"]).error
    # The real forecast for the target season, with the chosen models.
    final = predict(wide, target, chosen.to_dict())
    # The plain average as a reference point next to every prediction.
    baseline = predict(wide, target, dict.fromkeys(SERIES, "mean")).set_index("var")
    final = final.assign(baseline=final["var"].map(baseline.predicted), baseline_error=final["var"].map(baseline.error))
    train = with_index(wide, target - 1).loc[:target - 1]
    idx = final.set_index("var").loc["index"]
    # Rank among the training seasons: 1 = worse than every training season.
    rank = lambda v: int((train["index"] > v).sum() + 1)
    rows = final.round(4).to_dict("records")
    return {"target": target, "train": [int(train.index[0]), int(train.index[-1])], "made_on": date.today().isoformat(),
            # Validation summary: shown next to 2023/2024 so the result can't look cherry-picked.
            "validation": {"years": [int(val.season.min()), int(val.season.max())],
                           "compared": sorted(val.model.unique()), "tabpfn_model": TABPFN_MODEL,
                           "models": chosen.to_dict(), "inside_interval": int(picked.inside.sum()),
                           "beat_mean": int((picked.error < mean_err.loc[picked.index]).sum()),
                           "same_as_mean": int((picked.model == "mean").sum()), "of": len(picked)},
            "variables": [r for r in rows if r["var"] != "index"],
            "index": {**next(r for r in rows if r["var"] == "index"), "predicted_rank": rank(idx.predicted),
                      "actual_rank": rank(idx.actual), "of_years": len(train) + 1},
            # Training seasons, so the frontend can draw the chart without another request.
            "history": {"years": train.index.tolist(), **{n: train[n].round(4).tolist() for n in SERIES}}}


def api_key():
    # TAB_PFN_API_KEY from the environment, else from the repo-root .env (never printed).
    env = (ROOT / ".env").read_text().splitlines() if (ROOT / ".env").exists() else []
    # Parse KEY=value lines, skipping comments.
    found = dict(line.split("=", 1) for line in env if "=" in line and not line.lstrip().startswith("#"))
    return os.environ.get("TAB_PFN_API_KEY") or found["TAB_PFN_API_KEY"].strip().strip("\"'")


if __name__ == "__main__":
    # Models to compare: from the command line, or all three.
    models = sys.argv[1:] or list(MODELS)
    if "tabpfn" in models:
        set_access_token(api_key())
    for region in json.loads((DATA / "regions.json").read_text()):
        wide = seasons(pd.read_csv(DATA / region["id"] / "annual.csv"))
        # Validation runs once per region and is shared by both targets (model chosen before seeing them).
        val = validate(wide, models)
        for target in TARGETS:
            result = hindcast(wide, target, val)
            (DATA / region["id"] / f"forecast_{target}.json").write_text(json.dumps(result, indent=1))
            v = result["validation"]
            print(f"{region['id']} {target}: models {v['models']}; index rank predicted "
                  f"{result['index']['predicted_rank']}, actual {result['index']['actual_rank']} of "
                  f"{result['index']['of_years']}; validation inside {v['inside_interval']}/{v['of']}")
