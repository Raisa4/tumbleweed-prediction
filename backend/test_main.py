# Tests for the API endpoints (they run against the files in data/ and geo/output/).
from fastapi.testclient import TestClient

from main import app

# A fake browser that calls the API without starting the server.
client = TestClient(app)


def test_regions_lists_the_three_contract_regions():
    ids = [r["id"] for r in client.get("/regions").json()]
    assert ids == ["salt_lake_valley", "victorville", "tri_cities_wa"]


def test_pileup_serves_valid_thresholds_and_rejects_others():
    # 8 m/s exists -> a GeoJSON map; 16 m/s (old slider value, removed) -> error 422.
    ok = client.get("/layers/victorville/pileup.geojson", params={"threshold": 8})
    assert ok.status_code == 200 and ok.json()["type"] == "FeatureCollection"
    assert client.get("/layers/victorville/pileup.geojson", params={"threshold": 16}).status_code == 422


def test_unknown_region_is_404():
    assert client.get("/layers/mars/sources.geojson").status_code == 404


# The fields the frontend expects from /trend and /index (from the contract in CLAUDE.md).
TREND_KEYS = {"region", "var", "years", "values", "slope", "ci_low", "ci_high", "p", "trend", "significant", "verdict"}


def test_trend_and_index_follow_the_contract():
    assert set(client.get("/trend", params={"region": "victorville", "var": "windy_days"}).json()) == TREND_KEYS
    assert set(client.get("/index", params={"region": "victorville"}).json()) == TREND_KEYS
    # "rain" is not one of the 5 variables -> error 422.
    assert client.get("/trend", params={"region": "victorville", "var": "rain"}).status_code == 422


def test_backtest_has_one_row_per_event():
    # Salt Lake Valley has 5 events in events.csv; every rank must be between 1 and the number of seasons.
    rows = client.get("/backtest", params={"region": "salt_lake_valley"}).json()
    assert len(rows) == 5 and all(1 <= r["rank"] <= r["of_years"] for r in rows)


def test_forecast_serves_targets_only():
    assert client.get("/forecast", params={"region": "victorville", "target": 2023}).json()["target"] == 2023
    # 2020 is not a target season -> error 422.
    assert client.get("/forecast", params={"region": "victorville", "target": 2020}).status_code == 422


def test_hindcast_layers_serve_valid_requests_only():
    url, ok = "/layers/victorville/hindcast.geojson", {"threshold": 8, "target": 2023, "kind": "predicted"}
    assert client.get(url, params=ok).json()["type"] == "FeatureCollection"
    # Wrong kind or wrong target season -> error 422.
    assert client.get(url, params={**ok, "kind": "guess"}).status_code == 422
    assert client.get(url, params={**ok, "target": 2019}).status_code == 422
    sightings = client.get("/layers/victorville/sightings.geojson", params={"target": 2024})
    assert sightings.json()["type"] == "FeatureCollection"
