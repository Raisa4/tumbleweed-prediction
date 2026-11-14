# Saves every API answer as a static file, so the website can be hosted without a Python server
# (e.g. Azure Static Web Apps). Run from backend/:  python export_static.py
# Writes frontend/public/data/... (not /api: Azure Static Web Apps reserves /api for server functions); then `npm run build:static` in frontend/ puts them into dist/.
import shutil

from fastapi.testclient import TestClient

from forecast import TARGETS
from main import ROOT, THRESHOLDS, app, regions
from stats import SIGN

OUT = ROOT / "frontend" / "public" / "data"
# TestClient calls the real endpoints in-process, so the files are exactly what the live API returns.
client = TestClient(app)


def save(url, path):
    # Ask the API for one url and write the answer to OUT/path. A 404 (e.g. a variable A hasn't
    # delivered) is skipped: the website gets a 404 for the missing file too, and shows "coming soon".
    res = client.get(url)
    if res.status_code == 404:
        print(f"skipped (404): {url}")
        return
    # raise_for_status fails loudly on any other error, so a broken export never gets deployed.
    res.raise_for_status()
    (OUT / path).parent.mkdir(parents=True, exist_ok=True)
    (OUT / path).write_bytes(res.content)


if __name__ == "__main__":
    # Start clean, so files of a removed region/threshold don't linger.
    shutil.rmtree(OUT, ignore_errors=True)
    save("/regions", "regions.json")
    for r in [r["id"] for r in regions()]:
        for var in SIGN.index:
            save(f"/trend?region={r}&var={var}", f"trend/{r}/{var}.json")
        save(f"/index?region={r}", f"index/{r}.json")
        save(f"/backtest?region={r}", f"backtest/{r}.json")
        save(f"/layers/{r}/sources.geojson", f"layers/{r}/sources.geojson")
        for t in sorted(THRESHOLDS):
            save(f"/layers/{r}/pileup.geojson?threshold={t}", f"layers/{r}/pileup/{t}.geojson")
        for target in TARGETS:
            save(f"/forecast?region={r}&target={target}", f"forecast/{r}/{target}.json")
            save(f"/layers/{r}/sightings.geojson?target={target}", f"layers/{r}/sightings/{target}.geojson")
            for t in sorted(THRESHOLDS):
                for kind in ["predicted", "actual"]:
                    save(f"/layers/{r}/hindcast.geojson?threshold={t}&target={target}&kind={kind}",
                         f"layers/{r}/hindcast/{t}_{target}_{kind}.geojson")
    files = [p for p in OUT.rglob("*") if p.is_file()]
    print(f"{len(files)} files, {sum(p.stat().st_size for p in files) / 1e6:.0f} MB in {OUT}")
