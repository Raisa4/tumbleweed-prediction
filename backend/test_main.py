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
