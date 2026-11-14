import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getIndex, getTrend, type BacktestRow, type Trend } from "./api";
import { Badge } from "./TrendPanel";
import { INDEX, VARS, fmt, meta, seasonLabel } from "./vars";

const ordinal = (n: number) => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th");

export default function Tables({ region, events }: { region: string; events: BacktestRow[] }) {
  const [rows, setRows] = useState<Trend[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([getIndex(region), ...VARS.map((v) => getTrend(region, v.id))]).then((rs) => {
      if (alive) setRows(rs.filter((r): r is Trend => r !== null));
    });
    return () => {
      alive = false;
    };
  }, [region]);

  const index = rows.find((r) => r.var === "index");
  const hit = new Set(events.map((e) => e.season));
  const top = events.filter((e) => e.rank <= e.of_years / 3).length;

  return (
    <>
      <section className="panel">
        <h3>Was the index high before real pile-ups?</h3>
        {events.length === 0 ? (
          <p className="note">No recorded pile-ups for this region yet.</p>
        ) : (
          <>
            <p className="finding">
              <strong>
                {top} of {events.length}
              </strong>{" "}
              reported pile-ups here followed a season in the worst third of all seasons on record.
            </p>
            {index && (
              <>
                <div className="chart-legend">
                  <span>
                    <i style={{ background: "#CC4318" }} /> Season before a reported pile-up
                  </span>
                  <span>
                    <i style={{ background: "#D9C7A7" }} /> Other seasons
                  </span>
                </div>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={index.years.map((y, i) => ({ season: y, value: index.values[i] }))}
                      margin={{ top: 8, right: 8, bottom: 0, left: 4 }}
                    >
                      <CartesianGrid stroke="#E8D9BF" vertical={false} />
                      <XAxis dataKey="season" tick={{ fontSize: 12 }} tickLine={false} stroke="#A88B66" />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        width={52}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => fmt(v, 1)}
                        label={{ value: "index", angle: -90, position: "insideLeft", fontSize: 12, fill: "#7D5428" }}
                      />
                      <ReferenceLine y={0} stroke="#A88B66" />
                      <Tooltip
                        formatter={(v: number) => [fmt(v, 2), "Index"]}
                        labelFormatter={(s: number) => `Season ${s}: ${seasonLabel(s)}`}
                      />
                      <Bar dataKey="value" maxBarSize={20} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                        {index.years.map((y) => (
                          <Cell key={y} fill={hit.has(y) ? "#CC4318" : "#D9C7A7"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="note">
                  Above 0 = conditions more favourable to pile-ups than a normal season. Season{" "}
                  {index.years[0]} means {seasonLabel(index.years[0])}.
                </p>
              </>
            )}
            <table>
              <thead>
                <tr>
                  <th>Pile-up</th>
                  <th>Season that grew the plants</th>
                  <th>Index</th>
                  <th>How bad was that season?</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.date + e.place}>
                    <td>
                      <strong>{e.date}</strong>
                      <br />
                      {e.place}
                      {e.source_url && (
                        <>
                          {" "}
                          <a href={e.source_url} target="_blank" rel="noreferrer">
                            report
                          </a>
                        </>
                      )}
                    </td>
                    <td>{e.season}</td>
                    <td className="num">{fmt(e.index_value, 2)}</td>
                    <td>
                      <div className="rank" aria-hidden>
                        <i style={{ left: `${((e.rank - 1) / (e.of_years - 1)) * 100}%` }} />
                      </div>
                      {ordinal(e.rank)} worst of {e.of_years}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <p className="note">
          This checks a handful of pile-ups that made the news. It is a plausibility check, not an
          accuracy score: many pile-ups are never reported, and wind on the day matters as much as
          the season.
        </p>
      </section>

      <section className="panel">
        <h3>All trends in one table</h3>
        <table>
          <thead>
            <tr>
              <th>Driver</th>
              <th>Result</th>
              <th>Change per year</th>
              <th>95% range</th>
              <th>p-value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const m = meta(t.var);
              return (
                <tr key={t.var}>
                  <td>{m.label}</td>
                  <td>
                    <Badge t={t} m={m} />
                  </td>
                  <td className="num">
                    {t.slope.toPrecision(2)} {m.unit}
                  </td>
                  <td className="num">
                    {t.ci_low.toPrecision(2)} to {t.ci_high.toPrecision(2)}
                  </td>
                  <td className="num">{fmt(t.p, 3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="note">
          Mann-Kendall test with Sen's slope, {INDEX.label.toLowerCase()} first. A clear trend means
          p below 0.05.
        </p>
      </section>
    </>
  );
}
