import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getIndex, getTrend, type Trend } from "./api";
import { INDEX, VARS, fmt, type Variable } from "./vars";

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const sig = (x: number) => Number(x.toPrecision(2)).toLocaleString("en-US");

export function Badge({ t, m }: { t: Trend; m: Variable }) {
  const worse = (t.slope > 0 ? "up" : "down") === m.worseWhen;
  if (!t.significant) return <span className="badge flat">– No steady change</span>;
  return (
    <span className={worse ? "badge bad" : "badge good"}>
      {t.slope > 0 ? "▲" : "▼"} {worse ? "Getting worse" : "Easing"}
    </span>
  );
}

function plain(t: Trend, m: Variable) {
  const span = t.years[t.years.length - 1] - t.years[0];
  const unit = m.unit === "share of area" ? "" : ` ${m.unit}`;
  if (!t.significant)
    return `Goes up and down from year to year without a steady direction (p = ${fmt(t.p, 2)}). That is a real result too: we cannot say this driver is changing.`;
  const worse = (t.slope > 0 ? "up" : "down") === m.worseWhen;
  return `${t.slope > 0 ? "Rising" : "Falling"} by about ${sig(Math.abs(t.slope))}${unit} a year, roughly ${sig(Math.abs(t.slope * span))}${unit} over ${span} years. This makes pile-ups ${worse ? "more" : "less"} likely. A trend this steady would rarely appear by chance (p = ${fmt(t.p, 3)}).`;
}

function Chart({ t, m, height }: { t: Trend; m: Variable; height: number }) {
  const b = median(t.values.map((v, i) => v - t.slope * t.years[i]));
  const data = t.years.map((y, i) => ({ year: y, measured: t.values[i], trend: b + t.slope * y }));
  const show = (v: number) => fmt(v, m.digits);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: m.id === "index" ? 56 : 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="#E8D9BF" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} tickLine={false} stroke="#A88B66" />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 12 }}
            tickFormatter={show}
            width={52}
            tickLine={false}
            axisLine={false}
            label={{ value: m.unit, angle: -90, position: "insideLeft", fontSize: 12, fill: "#7D5428" }}
          />
          {m.id === "index" && (
            <ReferenceLine y={0} stroke="#A88B66" label={{ value: "normal", position: "right", fontSize: 11, fill: "#7D5428" }} />
          )}
          <Tooltip formatter={(v: number) => show(v)} labelFormatter={(y) => `Season ${y}`} />
          <Line name="Measured" dataKey="measured" stroke="#4A2208" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          <Line name="Trend line" dataKey="trend" stroke="#CC4318" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Card({ m, t, hero, note }: { m: Variable; t: Trend | null; hero?: boolean; note?: string }) {
  const [open, setOpen] = useState(false);

  if (!t)
    return (
      <article className="card muted">
        <h3>{m.label}</h3>
        <span className="badge flat">Coming soon</span>
        <p className="what">{m.definition}</p>
        <p className="note">
          The NASA data for this driver is still being processed. The index uses the other drivers
          until it arrives.
        </p>
      </article>
    );

  return (
    <article className={hero ? "card hero" : "card"}>
      <div className="card-head">
        <h3>{m.label}</h3>
        <Badge t={t} m={m} />
      </div>
      <p className="what">{m.definition}</p>
      <p className="finding">{plain(t, m)}</p>
      <Chart t={t} m={m} height={hero ? 280 : 190} />
      {note && <p className="note">{note}</p>}
      <button className="link" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Hide the statistics" : "Show the statistics"}
      </button>
      {open && (
        <dl className="numbers">
          <div>
            <dt>Change per year (Sen's slope)</dt>
            <dd>
              {sig(t.slope)} {m.unit}
            </dd>
          </div>
          <div>
            <dt>95% confidence range</dt>
            <dd>
              {sig(t.ci_low)} to {sig(t.ci_high)}
            </dd>
          </div>
          <div>
            <dt>p-value (Mann-Kendall)</dt>
            <dd>{fmt(t.p, 3)}</dd>
          </div>
          <div>
            <dt>Seasons</dt>
            <dd>
              {t.years[0]}–{t.years[t.years.length - 1]}
            </dd>
          </div>
          <p className="note">
            Source: {m.source}. Mann-Kendall test (Hamed-Rao, corrects for one year influencing the
            next). A trend counts as clear when p is below 0.05. If the 95% range includes 0, the
            data is consistent with no change.
          </p>
        </dl>
      )}
    </article>
  );
}

export default function TrendPanel({ region }: { region: string }) {
  const [index, setIndex] = useState<Trend | null>(null);
  const [trends, setTrends] = useState<(Trend | null)[] | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getIndex(region), ...VARS.map((v) => getTrend(region, v.id))]).then(
      ([idx, ...rest]) => {
        if (!alive) return;
        setIndex(idx);
        setTrends(rest);
      },
    );
    return () => {
      alive = false;
    };
  }, [region]);

  if (!trends) return <p className="note">Loading trends…</p>;

  const have = VARS.filter((_, i) => trends[i]).map((v) => v.label.toLowerCase());

  return (
    <>
      <div className="key">
        <span>
          <i className="k-line" /> Measured each season
        </span>
        <span>
          <i className="k-dash" /> Trend line (Sen's slope)
        </span>
        <span className="badge bad">▲ Getting worse</span>
        <span className="badge good">▼ Easing</span>
        <span className="badge flat">– No steady change</span>
      </div>
      <Card
        m={INDEX}
        t={index}
        hero
        note={`Built from ${have.length} drivers: ${have.join(", ")}. Each one is scaled so that 0 = its normal value, with soil moisture flipped because drier is worse.`}
      />
      <h3 className="sub">The drivers behind the index</h3>
      <div className="grid">
        {VARS.map((v, i) => (
          <Card key={v.id} m={v} t={trends[i]} />
        ))}
      </div>
    </>
  );
}
