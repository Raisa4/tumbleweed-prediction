import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Trend, fmt, urls, useJson } from './api'
import { ALL, Var } from './vars'

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2
}

function Badge({ t, v }: { t: Trend; v: Var }) {
  if (!t.significant) return <span className="badge flat">Not significant</span>
  const worse = (t.trend === 'increasing') === (v.worseWhen === 'up')
  return (
    <span className={`badge ${worse ? 'worse' : 'better'}`}>
      Significant {t.trend === 'increasing' ? '↑' : '↓'} · {worse ? 'worse' : 'better'} for tumbleweeds
    </span>
  )
}

function Chart({ t, v, eventSeasons }: { t: Trend; v: Var; eventSeasons: number[] }) {
  const b = median(t.values.map((y, i) => y - t.slope * t.years[i]))
  const data = t.years.map((year, i) => ({ year, value: t.values[i], sen: b + t.slope * year }))
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} width={48} />
          <Tooltip formatter={(x: number) => fmt(x)} />
          {eventSeasons.map((s) => (
            <ReferenceLine key={s} x={s} stroke="var(--event)" strokeDasharray="3 3" />
          ))}
          <Line dataKey="value" name={v.label} stroke="var(--ink)" dot={{ r: 2 }} isAnimationActive={false} />
          <Line dataKey="sen" name="Sen's slope trend" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="verdict">{t.verdict}</p>
      <p className="small">
        Rate of change: {fmt(t.slope)} {v.unit}/yr (95% confidence interval {fmt(t.ci_low)} to {fmt(t.ci_high)}).
        Tested with Mann-Kendall (Hamed–Rao, corrects for year-to-year memory); p &lt; 0.05 counts as significant.
        Dashed orange lines = seasons before real pile-ups.
      </p>
    </div>
  )
}

function Card({ v, region, open, onOpen, eventSeasons }: { v: Var; region: string; open: boolean; onOpen: () => void; eventSeasons: number[] }) {
  const t = useJson<Trend>(urls.trend(region, v.id))
  return (
    <div className={`card ${open ? 'open' : ''} ${v.id === 'index' ? 'index' : ''}`}>
      <button className="card-head" onClick={onOpen}>
        <span className="step">{v.step} · {v.source}</span>
        <strong>{v.label}</strong>
        {t instanceof Error ? <span className="error">{t.message}</span> : t && <Badge t={t} v={v} />}
      </button>
      <p className="small">{v.def}</p>
      {open && <p className="question">Question: {v.question}</p>}
      {open && t && !(t instanceof Error) && <Chart t={t} v={v} eventSeasons={eventSeasons} />}
    </div>
  )
}

export function TrendPanel({ region, selected, onSelect, eventSeasons }: {
  region: string; selected: string | null; onSelect: (id: string | null) => void; eventSeasons: number[]
}) {
  return (
    <section>
      {ALL.map((v) => (
        <Card key={v.id} v={v} region={region} open={selected === v.id} eventSeasons={eventSeasons}
          onOpen={() => onSelect(selected === v.id ? null : v.id)} />
      ))}
    </section>
  )
}
