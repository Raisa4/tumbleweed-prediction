#Trend tests, Tumbleweed Conditions Index and backtest
import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy.stats import theilslopes

ALPHA = 0.05
# +1: higher value = worse tumbleweed conditions. Drier autumn soil is worse, so its sign is flipped.
SIGN = pd.Series({"spring_precip": 1, "peak_ndvi_anom": 1, "autumn_soilm": -1, "windy_days": 1, "barren_frac": 1})
UNITS = {"spring_precip": "mm", "peak_ndvi_anom": "NDVI", "autumn_soilm": "kg/m²", "windy_days": "days",
         "barren_frac": "", "index": "std"}


def analyze(years, values, unit=""):
    #Hamed-Rao Mann-Kendall test, Sen's slope with 95% CI and a plain-English verdict.

    # Hamed-Rao corrects the p-value for year-to-year autocorrelation (a wet year often follows a wet year).
    test = mk.hamed_rao_modification_test(values, alpha=ALPHA)
    # Same Sen slope as pymannkendall, but scipy also returns its 95% confidence interval.
    slope, _, low, high = theilslopes(values, years, alpha=0.95)
    significant = bool(test.p < ALPHA)
    p = "p<0.001" if test.p < 0.001 else f"p={test.p:.3f}"
    verdict = (f"{test.trend.capitalize()} by {abs(slope):.3g} {unit}/yr — significant ({p})" if significant
               else f"No significant trend ({slope:+.3g} {unit}/yr, {p})").replace(" /", "/")
    # tolist()/float() turn numpy numbers into plain Python ones so FastAPI can send them as JSON.
    return {"years": np.asarray(years).tolist(), "values": np.asarray(values).tolist(), "slope": float(slope),
            "ci_low": float(low), "ci_high": float(high), "p": float(test.p), "trend": test.trend,
            "significant": significant, "verdict": verdict}


def seasons(annual):
    # One row per growth season Y; windy_days labelled Y+1 (its Nov Y–Apr Y+1 winter) joins season Y."""
    shifted = annual.assign(year=annual.year - annual.variable.eq("windy_days"))
    # dropna keeps only seasons that have all five variables (drops 2000 and 2025 until A adds windy_days 2026).
    return shifted.pivot(index="year", columns="variable", values="value")[SIGN.index].dropna()


def conditions_index(wide):
    #Mean of sign-adjusted z-scores across variables, one value per season."""
    z = (wide - wide.mean()) / wide.std()
    return (z * SIGN).mean(axis=1)


def season_of(dates):
    #Growth season behind a pile-up: Nov–Dec events -> same year, Jan–Oct events -> previous year."""
    return dates.dt.year - (dates.dt.month <= 10)


def backtest(index, events):
    #Per event: its season's index value and rank among all seasons (1 = worst)."""
    season = season_of(pd.to_datetime(events.date))
    rank = index.rank(ascending=False, method="min").astype(int)
    return pd.DataFrame({"date": events.date, "place": events.place, "season": season,
                         "index_value": index.round(2).reindex(season).values,
                         "rank": rank.reindex(season).values, "of_years": len(index)}).to_dict("records")
