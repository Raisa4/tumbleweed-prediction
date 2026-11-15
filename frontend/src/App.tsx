import { useEffect, useState } from "react";
import MapView from "./MapView";
import Tables from "./Tables";
import TrendPanel from "./TrendPanel";
import Forecast from "./Forecast";
import Demo from "./Demo";
import { BackendHelp } from "./MapView";
import { getBacktest, getRegions, usingFixtures, type BacktestRow, type Region } from "./api";

export type Tab = "map" | "trends" | "pileups" | "forecast";

const PAGES: { id: Exclude<Tab, "map">; label: string; question: string; lede: string }[] = [
  {
    id: "trends",
    label: "Trends",
    question: "Are tumbleweed conditions getting worse?",
    lede: "Each card is one weather or land driver measured by NASA every season since 2001, with a statistical test of whether it is really changing.",
  },
  {
    id: "pileups",
    label: "Past pile-ups",
    question: "Did our index see real pile-ups coming?",
    lede: "We take pile-ups that made the news and check how high our index was in the season that grew those plants.",
  },
  {
    id: "forecast",
    label: "Prediction vs reality",
    question: "Could we have warned them in advance?",
    lede: "We hid the most recent seasons, predicted them from earlier years only, and compare with what really happened.",
  },
];

const hashTab = (): Tab => PAGES.find((t) => "#" + t.id === window.location.hash)?.id ?? "map";

export default function App() {
  const [tab, setTab] = useState<Tab>(hashTab);
  const [demo, setDemo] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionId, setRegionId] = useState("");
  const [events, setEvents] = useState<BacktestRow[]>([]);

  useEffect(() => {
    getRegions().then((rs) => {
      setRegions(rs);
      setRegionId((id) => id || rs[0]?.id || "");
    });
    const sync = () => setTab(hashTab());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (!regionId) return;
    let alive = true;
    getBacktest(regionId).then((rs) => alive && setEvents(rs));
    return () => {
      alive = false;
    };
  }, [regionId]);

  const go = (t: Tab) => {
    window.location.hash = t === "map" ? "" : t;
  };

  const region = regions.find((r) => r.id === regionId);
  const page = PAGES.find((p) => p.id === tab);

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#">
          Tumbleweed Trend Detective
        </a>
        <nav className="tabs" aria-label="Sections">
          <a href="#" aria-current={tab === "map" ? "page" : undefined}>
            Map
          </a>
          {PAGES.map((p) => (
            <a key={p.id} href={"#" + p.id} aria-current={tab === p.id ? "page" : undefined}>
              {p.label}
            </a>
          ))}
        </nav>
        {page && (
          <label className="pick">
            <span>Region</span>
            <select value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {/* Link to the public source code, opens in a new tab. */}
        <a
          className="ghost"
          href="https://github.com/Raisa4/tumbleweed-prediction"
          target="_blank"
          rel="noreferrer"
        >
          Code on GitHub ↗
        </a>
        <button
          className="ghost"
          onClick={() => {
            setDemo(true);
            setRegionId("salt_lake_valley");
            go("trends");
          }}
        >
          ▶ Guided demo
        </button>
      </header>

      {demo && (
        <Demo
          onStep={(t, r) => {
            setRegionId(r);
            go(t);
          }}
          onClose={() => setDemo(false)}
        />
      )}

      <div className="stage">
        {regions.length > 0 && (
          <MapView regions={regions} regionId={regionId} onRegion={setRegionId} onOpen={go} />
        )}

        {page && region && (
          <div className="sheet">
            <main className="wrap">
              <button className="back" onClick={() => go("map")}>
                ← Back to the map
              </button>
              <h1 className="question">{page.question}</h1>
              <p className="lede">{page.lede}</p>
              {/* Region switch right on the page (same look as the season buttons), not only in the header. */}
              <div className="region-pick">
                <span>Region:</span>
                <div className="seg big" role="group" aria-label="Region">
                  {regions.map((r) => (
                    <button key={r.id} aria-pressed={r.id === regionId} onClick={() => setRegionId(r.id)}>
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
              {usingFixtures() && (
                <div className="warn">
                  Can't reach the backend, so you are seeing placeholder numbers, not NASA
                  measurements. <BackendHelp />
                </div>
              )}
              {tab === "trends" ? (
                <TrendPanel region={region.id} />
              ) : tab === "pileups" ? (
                <Tables region={region.id} events={events} />
              ) : (
                <Forecast region={region} />
              )}
              <footer className="note">
                Satellites cannot see single tumbleweeds: the plants are 0.5 to 2 m across, the
                pixels 250 to 500 m. We model conditions and habitat, not plants. Data: NASA GPM
                IMERG, MODIS MOD13Q1 and MCD12Q1, GLDAS Noah, MERRA-2 (via NASA POWER); sightings
                from GBIF and iNaturalist; streets and buildings from OpenStreetMap.
              </footer>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
