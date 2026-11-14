# Tests for forecast.py (offline: only the mean and Sen models, TabPFN needs the internet).
import numpy as np
import pandas as pd

from forecast import SERIES, hindcast, predict, sen_forecast, validate
from stats import SIGN

SEASONS = np.arange(2001, 2025)


def fake_wide(seed=0):
    # Fake seasons table: noise around 10 for every variable, plus a clear upward trend in windy_days.
    rng = np.random.default_rng(seed)
    wide = pd.DataFrame(rng.normal(10, 1, (len(SEASONS), len(SIGN))), index=SEASONS, columns=SIGN.index)
    wide["windy_days"] += 0.5 * (SEASONS - 2001)
    return wide


def test_target_season_data_does_not_change_its_prediction():
    # No leakage: making season 2023 wildly different (+100) must not change the forecast FOR 2023.
    wide, changed = fake_wide(), fake_wide()
    changed.loc[2023] += 100
    models = dict.fromkeys(SERIES, "sen")
    assert predict(wide, 2023, models).predicted.equals(predict(changed, 2023, models).predicted)


def test_sen_forecast_extends_a_perfect_line():
    # y = 2x exactly: next year must be 2 * 2011 = 4022, with a zero-width interval (no scatter).
    x = np.arange(2001, 2011)
    pred, low, high = sen_forecast(pd.DataFrame({"a": 2.0 * x}, index=x), 2011)
    assert np.isclose(pred["a"], 4022) and np.isclose(low["a"], high["a"])


def test_validation_picks_the_trend_for_a_trending_series():
    # windy_days has a real trend, so validation must choose "sen" over the plain average for it.
    wide = fake_wide()
    result = hindcast(wide, 2023, validate(wide, ["mean", "sen"]))
    assert result["validation"]["models"]["windy_days"] == "sen"
    # Validation covers 2011–2022, training for 2023 covers 2001–2022.
    assert result["validation"]["years"] == [2011, 2022] and result["train"] == [2001, 2022]
    # 22 training seasons + the target itself = 23 places in the ranking.
    assert 1 <= result["index"]["actual_rank"] <= result["index"]["of_years"] == 23
