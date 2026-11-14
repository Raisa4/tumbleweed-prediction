import numpy as np
import pandas as pd

from build import STEPS, deposit, pileup, source_weight


def line_case():
    source, barrier = np.zeros((5, 30)), np.zeros((5, 30))
    source[2, 2] = 1
    barrier[:, 10] = 1
    return source, barrier


def test_eastward_wind_piles_on_barrier_downwind():
    source, barrier = line_case()
    caught = deposit(source, barrier, *STEPS[2])
    assert caught[2, 10] == 1 and caught.sum() == 1


def test_upwind_and_out_of_reach_barriers_catch_nothing():
    source, barrier = line_case()
    assert deposit(source, barrier, *STEPS[6]).sum() == 0
    barrier[:, 10], barrier[:, 25] = 0, 1
    assert deposit(source, barrier, *STEPS[2]).sum() == 0


def test_pileup_uses_only_hours_above_threshold():
    source, barrier = line_case()
    barrier[:, 0] = 1
    per_dir = np.stack([deposit(source, barrier, dr, dc) for dr, dc in STEPS])
    wind = pd.DataFrame({"speed_ms": [9, 9, 13, 20], "dir_deg": [90, 85, 95, 270]})
    assert pileup(per_dir, wind, 8)[2, 10] == 1 and pileup(per_dir, wind, 8)[2, 0] == 1 / 3
    assert pileup(per_dir, wind, 14)[2, 10] == 0 and pileup(per_dir, wind, 14)[2, 0] == 1
    assert not pileup(per_dir, wind, 30).any()


def test_source_weight_in_unit_range():
    sightings, open_land = np.zeros((10, 10)), np.zeros((10, 10))
    sightings[5, 5], open_land[5, 5] = 3, 1
    w = source_weight(sightings, open_land)
    assert w.max() == 1 and w.min() >= 0
