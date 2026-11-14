import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, Tooltip, useMapEvents } from "react-leaflet";
import L, { type Map as LeafletMap } from "leaflet";
import {
  getBacktest,
  getPileup,
  getSources,
  usingFixtures,
  type BacktestRow,
  type Cells,
  type Region,
} from "./api";
import {
  BasemapSwitch,
  EventMarkers,
  PileupLayer,
  RiskScale,
  SourceLayer,
  StudyArea,
  Tiles,
  bounds,
  type Basemap,
} from "./MapBits";
import type { Tab } from "./App";
import { SOURCE_CLASSES, THRESHOLDS, fmt, riskColour } from "./vars";

const DETAIL_ZOOM = 8;

export function load<T>(set: (v: T | null) => void, fetch: () => Promise<T>) {
  let alive = true;
  set(null);
  fetch().then((v) => alive && set(v));
  return () => {
    alive = false;
  };
}

const loadAll = <T,>(regions: Region[], fetch: (id: string) => Promise<T>) =>
  Promise.all(regions.map((r) => fetch(r.id))).then((xs) =>
    Object.fromEntries(regions.map((r, i) => [r.id, xs[i]])),
  );

type Hotspot = { lat: number; lon: number; risk: number };

function hotspots(cells: Cells, n = 6): Hotspot[] {
  const all = cells.features
    .filter((f) => f.properties.risk >= 0.2)
    .map((f) => {
      const ring = f.geometry.coordinates[0];
      return {
        lon: ring.reduce((s, c) => s + c[0], 0) / ring.length,
        lat: ring.reduce((s, c) => s + c[1], 0) / ring.length,
        risk: f.properties.risk,
      };
    })
    .sort((a, b) => b.risk - a.risk);
  const kept: Hotspot[] = [];
  for (const h of all) {
    if (kept.every((k) => Math.hypot(k.lat - h.lat, k.lon - h.lon) > 0.025)) kept.push(h);
    if (kept.length === n) break;
  }
  return kept;
}

const pin = (colour: string, label = "") =>
  L.divIcon({
    className: "pin",
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
    html: `<svg viewBox="0 0 30 40" width="30" height="40"><path d="M15 39C15 39 2 23 2 14.5a13 13 0 0 1 26 0C28 23 15 39 15 39z" fill="${colour}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14.5" r="7.5" fill="#fff"/><g fill="none" stroke="${colour}" stroke-width="1.4"><ellipse cx="15" cy="14.5" rx="5.5" ry="2.6"/><ellipse cx="15" cy="14.5" rx="5.5" ry="2.6" transform="rotate(60 15 14.5)"/><ellipse cx="15" cy="14.5" rx="5.5" ry="2.6" transform="rotate(120 15 14.5)"/></g></svg>${label && `<span>${label}</span>`}`,
  });

function Zoom({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

export function WindSlider({ value, onChange }: { value: number; onChange: (t: number) => void }) {
  return (
    <div className="wind">
      <label htmlFor="wind">
        Wind strong enough to roll a plant: <strong>{value} m/s</strong> ({Math.round(value * 3.6)}{" "}
        km/h)
      </label>
      <input
        id="wind"
        type="range"
        min={THRESHOLDS[0]}
        max={THRESHOLDS[THRESHOLDS.length - 1]}
        step={2}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
      <div className="ticks" aria-hidden>
        {THRESHOLDS.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <p className="note">
        Our assumption, so you can change it. It applies to NASA MERRA-2 hourly average wind over a
        ~50 km area, not to gusts at the ground, which are stronger.
      </p>
    </div>
  );
}

export function BackendHelp() {
  return (
    <>
      Start it with <code>cd backend && ../.venv/bin/uvicorn main:app</code>, and open this site at{" "}
      <code>http://localhost:5173</code> (the backend only answers that address).
    </>
  );
}

const STATS: { tab: Tab; label: string; question: string }[] = [
  { tab: "trends", label: "Trends", question: "Are conditions getting worse?" },
  { tab: "pileups", label: "Past pile-ups", question: "Did the index see them coming?" },
  { tab: "forecast", label: "Prediction vs reality", question: "Could we have warned them?" },
];

export default function MapView({
  regions,
  regionId,
  onRegion,
  onOpen,
}: {
  regions: Region[];
  regionId: string;
  onRegion: (id: string) => void;
  onOpen: (t: Tab) => void;
}) {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [zoom, setZoom] = useState(5);
  const [sources, setSources] = useState<Record<string, Cells> | null>(null);
  const [pileup, setPileup] = useState<Record<string, Cells> | null>(null);
  const [events, setEvents] = useState<BacktestRow[]>([]);
  const [showSources, setShowSources] = useState(true);
  const [showPileup, setShowPileup] = useState(true);
  const [threshold, setThreshold] = useState(8);
  const [basemap, setBasemap] = useState<Basemap>("streets");

  useEffect(() => load(setSources, () => loadAll(regions, getSources)), [regions]);
  useEffect(
    () => load(setPileup, () => loadAll(regions, (id) => getPileup(id, threshold))),
    [regions, threshold],
  );
  useEffect(() => {
    loadAll(regions, getBacktest).then((b) => setEvents(Object.values(b).flat()));
  }, [regions]);

  const all = useMemo(
    () => L.latLngBounds(regions.flatMap((r) => bounds(r.bbox))).pad(0.15),
    [regions],
  );
  useEffect(() => {
    map?.fitBounds(all);
  }, [map, all]);

  const spots = useMemo(
    () => (pileup ? Object.fromEntries(regions.map((r) => [r.id, hotspots(pileup[r.id])])) : {}),
    [pileup, regions],
  );

  const region = regions.find((r) => r.id === regionId);
  const fly = (r: Region) => map?.flyToBounds(bounds(r.bbox), { duration: 1.2 });
  const first = useRef(true);
  useEffect(() => {
    if (!map || !region) return;
    if (first.current) first.current = false;
    else fly(region);
  }, [map, regionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const goTo = (r: Region) => (r.id === regionId ? fly(r) : onRegion(r.id));
  const detail = zoom >= DETAIL_ZOOM;
  const hours = pileup?.[regionId]?.features[0]?.properties.hours;
  const located = events.filter((e) => e.lat != null);

  return (
    <div className="stage-map">
      <MapContainer
        className="full-map"
        ref={setMap}
        center={[40, -115]}
        zoom={5}
        zoomSnap={0.25}
        zoomControl={false}
        preferCanvas
      >
        <Zoom onZoom={setZoom} />
        <Tiles basemap={basemap} />
        {regions.map((r) => (
          <StudyArea key={r.id} bbox={r.bbox} />
        ))}
        {detail &&
          showSources &&
          sources &&
          regions.map((r) => <SourceLayer key={"s" + r.id} data={sources[r.id]} />)}
        {detail &&
          showPileup &&
          pileup &&
          regions.map((r) => <PileupLayer key={`p${r.id}${threshold}`} data={pileup[r.id]} />)}
        {detail && <EventMarkers events={located} />}
        {detail &&
          showPileup &&
          regions.flatMap((r) =>
            (spots[r.id] ?? []).map((h, i) => (
              <Marker key={`${r.id}${i}${threshold}`} position={[h.lat, h.lon]} icon={pin(riskColour(h.risk))}>
                <Tooltip direction="top" offset={[0, -36]}>
                  Pile-up hotspot · risk {fmt(h.risk, 2)}
                </Tooltip>
                <Popup>
                  <strong>
                    Hotspot {i + 1} in {r.name}
                  </strong>
                  <br />
                  Pile-up risk <b>{fmt(h.risk, 2)}</b> of 1 with wind ≥ {threshold} m/s.
                  <br />
                  Where windblown plants are most likely to stop against buildings and fences.
                  Modelled from habitat and wind, not observed.
                </Popup>
              </Marker>
            )),
          )}
        {!detail &&
          regions.map((r) => (
            <Marker
              key={r.id}
              position={[(r.bbox[1] + r.bbox[3]) / 2, (r.bbox[0] + r.bbox[2]) / 2]}
              icon={pin("#B23A12", r.name)}
              eventHandlers={{ click: () => goTo(r) }}
            >
              <Tooltip direction="top" offset={[0, -36]}>
                Click to zoom in
              </Tooltip>
            </Marker>
          ))}
      </MapContainer>

      <nav className="float left" aria-label="Regions">
        <h2>Regions</h2>
        {regions.map((r) => (
          <button key={r.id} aria-pressed={r.id === regionId && detail} onClick={() => goTo(r)}>
            <span className="swatch" />
            {r.name}
          </button>
        ))}
        <button className="all" onClick={() => map?.flyToBounds(all, { duration: 1.2 })}>
          Show all regions
        </button>
        <div className="zoom">
          <button aria-label="Zoom in" onClick={() => map?.zoomIn()}>
            +
          </button>
          <button aria-label="Zoom out" onClick={() => map?.zoomOut()}>
            −
          </button>
        </div>
      </nav>

      <aside className="side">
        {usingFixtures() && (
          <p className="warn">
            Can't reach the backend, so the map is empty. <BackendHelp />
          </p>
        )}
        {!detail && (
          <p className="hint">Pick a region on the left or click a pin to see the map layers.</p>
        )}

        <section>
          <WindSlider value={threshold} onChange={setThreshold} />
          {hours != null && region && (
            <p className="stat-line">
              {region.name}: <strong>{hours.toLocaleString("en-US")} hours</strong> of wind ≥{" "}
              {threshold} m/s in the winters 2001–2025.
            </p>
          )}
        </section>

        <section>
          <div className="side-head">
            <h3>Layers</h3>
            <BasemapSwitch value={basemap} onChange={setBasemap} />
          </div>
          <label className="layer-head">
            <input type="checkbox" checked={showPileup} onChange={(e) => setShowPileup(e.target.checked)} />
            Where the wind piles them up
          </label>
          <div className={showPileup ? "legend" : "legend off"}>
            <RiskScale />
            <p className="key-row">
              <span className="mini-pin" /> Top hotspots: highest pile-up risk
            </p>
          </div>
          <label className="layer-head">
            <input type="checkbox" checked={showSources} onChange={(e) => setShowSources(e.target.checked)} />
            Where tumbleweeds grow
          </label>
          <ul className={showSources ? "keys legend" : "keys legend off"}>
            {SOURCE_CLASSES.map((c) => (
              <li key={c.label}>
                <i style={{ background: c.colour }} /> {c.label}
              </li>
            ))}
          </ul>
          <p className="key-row">
            <i className="dot" /> Real pile-up from the news{located.length ? "" : " (coming soon)"}
          </p>
          <p className="note">
            250 m squares. Plants are pushed downwind up to 4 km with real NASA wind directions and
            stop against buildings and fences. Satellites cannot see single tumbleweeds: this shows
            habitat and wind, not plants.
          </p>
        </section>

        <section>
          <h3>Statistics{region && <> for {region.name}</>}</h3>
          <div className="stat-buttons">
            {STATS.map((s) => (
              <button key={s.tab} onClick={() => onOpen(s.tab)}>
                <strong>{s.label}</strong>
                <span>{s.question}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
