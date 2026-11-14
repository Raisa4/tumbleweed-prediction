import numpy as np
import pandas as pd

from stats import analyze, backtest, conditions_index, season_of, seasons

YEARS = np.arange(2001, 2026)
NOISE = np.random.default_rng(0).normal(0, 1, len(YEARS))


def test_upward_trend_is_significant():
    r = analyze(YEARS, 0.5 * (YEARS - 2001) + NOISE, "days")
    assert r["significant"] and r["trend"] == "increasing" and 0 < r["ci_low"] < r["slope"] < r["ci_high"]


def test_flat_noise_is_not_significant():
    r = analyze(YEARS, NOISE)
    assert not r["significant"] and r["trend"] == "no trend"


def test_drier_soil_raises_the_index():
    wide = pd.DataFrame({"spring_precip": [1, 2, 3], "peak_ndvi_anom": [1, 2, 3], "autumn_soilm": [3, 2, 1],
                         "windy_days": [1, 2, 3], "barren_frac": [1, 2, 3]})
    assert conditions_index(wide).tolist() == [-1, 0, 1]


def test_windy_days_and_events_map_to_growth_season():
    annual = pd.DataFrame({"year": [2023, 2023, 2023, 2023, 2024],
                           "variable": ["spring_precip", "peak_ndvi_anom", "autumn_soilm", "barren_frac", "windy_days"],
                           "value": [1, 2, 3, 4, 5]})
    assert seasons(annual).index.tolist() == [2023]
    assert season_of(pd.to_datetime(pd.Series(["2024-03-02", "2019-12-31"]))).tolist() == [2023, 2019]


def test_backtest_ranks_event_season():
    index = pd.Series([0.1, 0.9, -0.5], index=[2016, 2017, 2018])
    events = pd.DataFrame({"date": ["2018-04-16"], "place": ["Victorville, CA"]})
    assert backtest(index, events) == [{"date": "2018-04-16", "place": "Victorville, CA", "season": 2017,
                                        "index_value": 0.9, "rank": 1, "of_years": 3}]
