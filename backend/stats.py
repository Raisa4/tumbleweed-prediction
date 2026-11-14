# Trend tests, Tumbleweed Conditions Index and backtest.
import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy.stats import theilslopes

# Significance level: a trend counts as "significant" when p < 0.05.
ALPHA = 0.05
# Direction of each variable in the index.
# +1: a higher value means worse tumbleweed conditions (more rain -> more plants, more wind, more open land).
# -1: autumn soil moisture, because drier soil (a LOWER value) is worse.
SIGN = pd.Series({"spring_precip": 1, "peak_ndvi_anom": 1, "autumn_soilm": -1, "windy_days": 1, "barren_frac": 1})
# Units used in the plain-English verdict, e.g. "Increasing by 0.8 days/yr".
UNITS = {"spring_precip": "mm", "peak_ndvi_anom": "NDVI", "autumn_soilm": "kg/m²", "windy_days": "days",
         "barren_frac": "", "index": "std"}


def analyze(years, values, unit=""):
    # Hamed-Rao Mann-Kendall test, Sen's slope with 95% CI and a plain-English verdict.
    # Used by both /trend (one variable) and /index (the combined index).

    # Mann-Kendall asks: do the values keep going up (or down) over the years, more than chance would allow?
    # Hamed-Rao corrects the p-value for year-to-year autocorrelation (a wet year often follows a wet year).
    test = mk.hamed_rao_modification_test(values, alpha=ALPHA)
    # Sen's slope = median of the slopes between every pair of years ("how much per year").
    # scipy gives the same slope as pymannkendall, but also its 95% confidence interval (low, high).
    slope, _, low, high = theilslopes(values, years, alpha=0.95)
    significant = bool(test.p < ALPHA)
    # Very small p-values are shown as "p<0.001" instead of "p=0.000".
    p = "p<0.001" if test.p < 0.001 else f"p={test.p:.3f}"
    # The sentence the website shows; .replace removes the space when the unit is empty ("0.002/yr").
    verdict = (f"{test.trend.capitalize()} by {abs(slope):.3g} {unit}/yr — significant ({p})" if significant
               else f"No significant trend ({slope:+.3g} {unit}/yr, {p})").replace(" /", "/")
    # tolist()/float() turn numpy numbers into plain Python ones so FastAPI can send them as JSON.
    return {"years": np.asarray(years).tolist(), "values": np.asarray(values).tolist(), "slope": float(slope),
            "ci_low": float(low), "ci_high": float(high), "p": float(test.p), "trend": test.trend,
            "significant": significant, "verdict": verdict}


def seasons(annual):
    # Turns A's long table (year, variable, value) into one row per growth season Y, one column per variable.
    # windy_days labelled Y+1 covers the winter Nov Y–Apr Y+1, which blows the plants grown in Y,
    # so we subtract 1 from its year to put it in season Y.
    shifted = annual.assign(year=annual.year - annual.variable.eq("windy_days"))
    # pivot: rows = seasons, columns = variables. [SIGN.index] fixes the column order (and fails if one is missing).
    # dropna keeps only seasons that have all five variables (drops 2000 and 2025 until A adds windy_days 2026).
    return shifted.pivot(index="year", columns="variable", values="value")[SIGN.index].dropna()


def conditions_index(wide):
    # Tumbleweed Conditions Index: one number per season, 0 = a normal season, positive = worse than normal.
    # z-score = (value - mean) / standard deviation, so rain in mm and wind in days end up on the same scale.
    z = (wide - wide.mean()) / wide.std()
    # Flip autumn_soilm (SIGN = -1), then average the five variables.
    return (z * SIGN).mean(axis=1)


def season_of(dates):
    # Growth season behind a pile-up: Nov–Dec events -> same year, Jan–Oct events -> previous year.
    # Example: 2024-03-02 (South Jordan) -> season 2023; 2019-12-31 (Hwy 240) -> season 2019.
    return dates.dt.year - (dates.dt.month <= 10)


def backtest(index, events):
    # For each news-reported pile-up: the index of the season that grew its plants,
    # and how that season ranks among all seasons (1 = worst season on record).
    season = season_of(pd.to_datetime(events.date))
    # rank: highest index gets 1; ties share the best rank ("min").
    rank = index.rank(ascending=False, method="min").astype(int)
    # reindex(season) looks up each event's season in the index / rank tables.
    return pd.DataFrame({"date": events.date, "place": events.place, "season": season,
                         "index_value": index.round(2).reindex(season).values,
                         "rank": rank.reindex(season).values, "of_years": len(index)}).to_dict("records")
