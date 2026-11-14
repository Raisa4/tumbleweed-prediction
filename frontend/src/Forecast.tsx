import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  Scatter,
  XAxis,
  YAxis,
} from "recharts";
import type { Map as LeafletMap } from "leaflet";
import {
  getForecast,
  getHindcast,
  getSightings,
  type Cells,
  type Forecast as F,
  type Points,
  type Prediction,
  type Region,
} from "./api";
import { BaseMap, PileupLayer, RiskScale, SightingDots } from "./MapBits";
import { WindSlider, load } from "./MapView";
import { METHODS, fmt, meta, seasonLabel } from "./vars";

const TARGETS = [2023, 2024];

function Chart({ f, row }: { f: F; row: Prediction }) {
  const m = meta(row.var);
  const show = (v: number) => fmt(v, m.digits);
  const data = [
    ...f.history.years.map((y, i) => ({ year: y, hist: f.history[row.var][i] })),
    { year: f.target, pred: row.predicted, actual: row.actual },
  ];
  return (
    <ComposedChart width={600} height={300} data={data} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
      <CartesianGrid stroke="#E8D9BF" vertical={false} />
      <XAxis
        dataKey="year"
        type="number"
        domain={[f.history.years[0], f.target + 0.5]}
        ticks={[...f.history.years.filter((y) => y % 5 === 0), f.target]}
        tick={{ fontSize: 12 }}
        tickLine={false}
        stroke="#A88B66"
      />
      <YAxis
        domain={["auto", "auto"]}
        tickFormatter={show}
        tick={{ fontSize: 12 }}
        width={56}
        tickLine={false}
        axisLine={false}
        label={{ value: m.unit, angle: -90, position: "insideLeft", fontSize: 12, fill: "#7D5428" }}
      />
      <ReferenceArea
        x1={f.target - 0.4}
        x2={f.target + 0.4}
        y1={row.pi_low}
        y2={row.pi_high}
        fill="#E27A2B"
        fillOpacity={0.3}
        stroke="#C85614"
        strokeOpacity={0.6}
      />
      <Line dataKey="hist" stroke="#4A2208" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
      <Scatter dataKey="pred" fill="#C85614" shape="diamond" isAnimationActive={false} />
      <Scatter dataKey="actual" fill="#1B0C03" isAnimationActive={false} />
    </ComposedChart>
  );
}

function HindcastMap({
  region,
  target,
  train,
  threshold,
  kind,
  sightings,
  onReady,
}: {
  region: Region;
  target: number;
  train: [number, number];
  threshold: number;
  kind: "predicted" | "actual";
  sightings: Points | null;
  onReady: (m: LeafletMap) => void;
}) {
  const [cells, setCells] = useState<Cells | null>(null);
  useEffect(
    () => load(setCells, () => getHindcast(region.id, threshold, target, kind)),
    [region.id, threshold, target, kind],
  );
  const hours = cells?.features[0]?.properties.hours ?? 0;

  return (
    <figure className="hc-map">
      <figcaption>
        <strong>
          {kind === "predicted" ? "Predicted" : "What really happened"}
        </strong>{" "}
        {kind === "predicted"
          ? `using the average wind of ${train[0]}–${train[1]}`
          : `using the real wind of season ${target}`}
        <span>
          {fmt(hours, 0)} hours ≥ {threshold} m/s{kind === "predicted" ? " in an average season" : ""}
        </span>
      </figcaption>
      <div className="map-frame">
        <BaseMap region={region} className="map small" onReady={onReady}>
          {cells && <PileupLayer key={`${kind}-${region.id}-${threshold}-${target}`} data={cells} />}
          {sightings && <SightingDots data={sightings} />}
        </BaseMap>
        {cells && cells.features.length === 0 && (
          <div className="map-empty">
            No wind reached {threshold} m/s this season, so nothing tumbles at this setting.
          </div>
        )}
      </div>
    </figure>
  );
}

export default function Forecast({ region }: { region: Region }) {
  const [target, setTarget] = useState(2023);
  const [f, setF] = useState<F | null | undefined>(undefined);
  const [pick, setPick] = useState("index");
  const [threshold, setThreshold] = useState(8);
  const [sightings, setSightings] = useState<Points | null>(null);
  const maps = useRef<LeafletMap[]>([]);

  useEffect(() => {
    let alive = true;
    setF(undefined);
    getForecast(region.id, target).then((v) => alive && setF(v));
    return () => {
      alive = false;
    };
  }, [region.id, target]);
  useEffect(() => load(setSightings, () => getSightings(region.id, target)), [region.id, target]);

  const ready = useMemo(
    () =>
      [0, 1].map((i) => (m: LeafletMap) => {
        if (maps.current[i] === m) return;
        maps.current[i] = m;
        m.on("moveend", () => {
          const other = maps.current[1 - i];
          if (!other) return;
          const c = m.getCenter();
          if (!other.getCenter().equals(c) || other.getZoom() !== m.getZoom())
            other.setView(c, m.getZoom(), { animate: false });
        });
      }),
    [],
  );

  if (f === undefined) return <p className="note">Loading the prediction…</p>;
  if (f === null)
    return (
      <p className="warn">
        The prediction files come from the backend. Start it with{" "}
        <code>cd backend && uvicorn main:app</code> and reload.
      </p>
    );

  const rows = [f.index, ...f.variables];
  const row = rows.find((r) => r.var === pick) ?? f.index;
  const v = f.validation;
  const missed = rows.filter((r) => !r.inside);

  return (
    <div className="hc">
      <div className="hc-top">
        <div className="seg big" role="group" aria-label="Season to predict">
          {TARGETS.map((t) => (
            <button key={t} aria-pressed={t === target} onClick={() => setTarget(t)}>
              Season {t}
            </button>
          ))}
        </div>
        <p>
          <strong>Season {f.target}</strong>: {seasonLabel(f.target)}. Predicted using only{" "}
          {f.train[0]}–{f.train[1]}; frozen on {f.made_on}.
        </p>
      </div>

      <p className="score">
        <strong>How much to trust it:</strong> we first tested the method on {v.years[0]}–
        {v.years[1]}, predicting each season from the ones before it. The real value fell inside our
        95% range <strong>{v.inside_interval} of {v.of}</strong> times. Where the chosen method
        differed from the plain long-term average, it was closer{" "}
        <strong>
          {v.beat_mean} of {v.of - v.same_as_mean}
        </strong>{" "}
        times.
      </p>

      <div className="hc-row">
        <div className="panel tight">
          <h3>{meta(row.var).label}: predicted vs actual</h3>
          <div className="chart-legend">
            <span>
              <i style={{ background: "#4A2208" }} /> Seasons used to learn
            </span>
            <span>
              <i style={{ background: "#E27A2B", opacity: 0.6 }} /> 95% range we predicted
            </span>
            <span>
              <i className="diamond" /> Prediction
            </span>
            <span>
              <i className="round" /> What happened
            </span>
          </div>
          <Chart f={f} row={row} />
          <p className="finding">
            Season {f.target}: predicted <strong>{fmt(row.predicted, meta(row.var).digits)}</strong>{" "}
            (95% range {fmt(row.pi_low, meta(row.var).digits)} to {fmt(row.pi_high, meta(row.var).digits)}),
            actual <strong>{fmt(row.actual, meta(row.var).digits)}</strong>:{" "}
            {row.inside ? "✓ inside the range" : "✗ outside the range"}.
          </p>
        </div>
        <div className="tiles">
          <div className="tile">
            <span>Predicted rank of season {f.target}</span>
            <strong>
              {f.index.predicted_rank} of {f.index.of_years}
            </strong>
          </div>
          <div className="tile">
            <span>Actual rank</span>
            <strong>
              {f.index.actual_rank} of {f.index.of_years}
            </strong>
          </div>
          <p className="note">
            Rank 1 = worse than every season before it. Index = all drivers combined, 0 = normal.
          </p>
        </div>
      </div>

      <table className="hc-table">
        <thead>
          <tr>
            <th>Driver (click to chart)</th>
            <th>Method</th>
            <th>Predicted</th>
            <th>95% range</th>
            <th>Actual</th>
            <th>Inside range?</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = meta(r.var);
            const show = (x: number) => fmt(x, m.digits);
            return (
              <tr
                key={r.var}
                className={r.var === row.var ? "picked" : undefined}
                onClick={() => setPick(r.var)}
              >
                <td>
                  <button className="link" onClick={() => setPick(r.var)}>
                    {m.label}
                  </button>
                </td>
                <td>{METHODS[r.model]}</td>
                <td className="num">{show(r.predicted)}</td>
                <td className="num">
                  {show(r.pi_low)} – {show(r.pi_high)}
                </td>
                <td className="num">
                  {show(r.actual)} {m.unit === "share of area" ? "" : m.unit}
                </td>
                <td>{r.inside ? "✓ Yes" : "✗ No"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {missed.length > 0 && (
        <p className="note">
          {missed.map((r) => meta(r.var).label).join(", ")} fell outside the range. Rain and wind in
          a single year are mostly unpredictable, so misses are expected now and then.
        </p>
      )}
      <p className="note">
        {v.years[1] - v.years[0] + 1} test seasons plus 2 final seasons is a demonstration, not an
        accuracy score.
      </p>

      <h3 className="sub">Where would they pile up?</h3>
      <div className="hc-maps-top">
        <WindSlider value={threshold} onChange={setThreshold} />
        <div>
          <RiskScale />
          <p className="note">
            <i className="dot purple" /> Tumbleweed sightings reported in {f.target} (GBIF,
            iNaturalist). Both maps share one colour scale: equal colour = equal risk.
          </p>
        </div>
      </div>
      <div className="hc-maps">
        {(["predicted", "actual"] as const).map((k, i) => (
          <HindcastMap
            key={k}
            region={region}
            target={f.target}
            train={f.train}
            threshold={threshold}
            kind={k}
            sightings={sightings}
            onReady={ready[i]}
          />
        ))}
      </div>
    </div>
  );
}
