# Tests for hindcast.py (no internet needed).
import numpy as np
import pandas as pd

from hindcast import direction_hours, maps


def wind(times, dirs):
    # Tiny wind table where every hour is strong (20 m/s).
    return pd.DataFrame({"time": times, "speed_ms": 20, "dir_deg": dirs})


def test_hours_land_in_growth_season_and_direction_bin():
    # Nov 2023 and Mar 2024 -> season 2023, blowing east (bin 2); Dec 2024 -> season 2024, blowing north (bin 0).
    hours = direction_hours(wind(["2023-11-05T00:00", "2024-03-02T00:00", "2024-12-01T00:00"], [90, 90, 0]), 12)
    assert hours.loc[2023, 2] == 2 and hours.loc[2024, 0] == 1 and hours.to_numpy().sum() == 3


def test_target_season_wind_does_not_change_the_prediction():
    # No leakage: a huge change in the 2023 wind must not change the predicted 2023 pattern.
    per_dir = np.random.default_rng(0).random((8, 4, 4))
    hours = pd.DataFrame(np.ones((3, 8)), index=[2021, 2022, 2023])
    changed = hours.copy()
    changed.loc[2023] = 50
    predicted, _ = maps(per_dir, hours, 2023)
    predicted_changed, actual_changed = maps(per_dir, changed, 2023)
    # Only the shared scale moves: the predicted pattern is identical up to that factor.
    assert np.allclose(predicted / predicted.max(), predicted_changed / predicted_changed.max())
    assert actual_changed.max() == 1
