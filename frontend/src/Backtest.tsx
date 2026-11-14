import { BacktestRow, fmt, ordinal } from './api'

export function Backtest({ rows, highlight }: { rows: BacktestRow[]; highlight: string | null }) {
  const top = rows.filter((r) => r.rank <= r.of_years / 5).length
  return (
    <section id="backtest" className="card">
      <strong>Reality check: was the index high before real pile-ups?</strong>
      <p className="small">
        For each news-reported pile-up we look up the Index for the growing season before it and rank it against
        all {rows[0]?.of_years ?? 25} years (1st = worst conditions). {top} of {rows.length} events followed a top-20% season.
        This is a plausibility check on a handful of events, not an accuracy score.
      </p>
      <table>
        <thead><tr><th>Event</th><th>Where</th><th>Season</th><th>Index</th><th>Rank</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date + r.place} className={highlight && r.place.startsWith(highlight) ? 'hl' : ''}>
              <td>{r.date}</td>
              <td><a href={r.source_url} target="_blank" rel="noreferrer">{r.place.split(':')[0]}</a></td>
              <td>{r.season}</td>
              <td>{fmt(r.index_value)}</td>
              <td className={r.rank <= r.of_years / 5 ? 'hot' : ''}>{ordinal(r.rank)} of {r.of_years}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
