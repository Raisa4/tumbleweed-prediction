from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_regions_lists_the_three_contract_regions():
    ids = [r["id"] for r in client.get("/regions").json()]
    assert ids == ["salt_lake_valley", "victorville", "tri_cities_wa"]


def test_pileup_serves_valid_thresholds_and_rejects_others():
    ok = client.get("/layers/victorville/pileup.geojson", params={"threshold": 12})
    assert ok.status_code == 200 and ok.json()["type"] == "FeatureCollection"
    assert client.get("/layers/victorville/pileup.geojson", params={"threshold": 11}).status_code == 422


def test_unknown_region_is_404():
    assert client.get("/layers/mars/sources.geojson").status_code == 404


TREND_KEYS = {"region", "var", "years", "values", "slope", "ci_low", "ci_high", "p", "trend", "significant", "verdict"}


def test_trend_and_index_follow_the_contract():
    assert set(client.get("/trend", params={"region": "victorville", "var": "windy_days"}).json()) == TREND_KEYS
    assert set(client.get("/index", params={"region": "victorville"}).json()) == TREND_KEYS
    assert client.get("/trend", params={"region": "victorville", "var": "rain"}).status_code == 422


def test_backtest_has_one_row_per_event():
    rows = client.get("/backtest", params={"region": "salt_lake_valley"}).json()
    assert len(rows) == 5 and all(1 <= r["rank"] <= r["of_years"] for r in rows)
