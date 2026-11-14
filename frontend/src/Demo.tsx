import { useEffect } from 'react'
import { BacktestRow, Trend, ordinal, urls, useJson } from './api'
import type { View } from './App'

const R = 'salt_lake_valley'

export function Demo({ step, setStep, setView }: {
  step: number; setStep: (s: number | null) => void; setView: (v: Partial<View>) => void
}) {
  const index = useJson<Trend>(urls.trend(R, 'index'))
  const windy = useJson<Trend>(urls.trend(R, 'windy_days'))
  const bt = useJson<BacktestRow[]>(urls.backtest(R))
  const ready = index && windy && bt && !(index instanceof Error) && !(windy instanceof Error) && !(bt instanceof Error)
  const sj = ready ? bt.find((r) => r.place.startsWith('South Jordan')) : undefined

  const steps: { title: string; text: string; view: Partial<View> }[] = ready && sj ? [
    {
      title: 'Why did South Jordan get buried in March 2024?',
      text: 'On 2 March 2024 strong winds rolled tumbleweeds into the Daybreak neighbourhood of South Jordan, Utah, blocking whole streets. City crews needed plows and excavators. Was this bad luck, or part of a trend we can measure from space?',
      view: { region: R, selected: null, focus: null, highlight: null },
    },
    {
      title: 'A tumbleweed needs five things',
      text: 'Wet spring → seedlings sprout. Green summer → plants bulk up. Dry autumn → they go brittle and snap off. Windy winter → they roll. Open land → room to grow. Each card on the left is one link in this chain, measured by a NASA mission or model. Satellites cannot see single tumbleweeds, so we measure the conditions they need.',
      view: { selected: null },
    },
    {
      title: 'Is it getting worse?',
      text: `The Tumbleweed Conditions Index combines all five links. ${index.verdict}. The dashed orange line marks the ${sj.season} season, just before the pile-up.`,
      view: { selected: 'index' },
    },
    {
      title: 'Which link is changing?',
      text: `Windy days: ${windy.verdict}. Not every variable has a significant trend, and that is a real result too: it means we can't tell the change apart from normal year-to-year ups and downs.`,
      view: { selected: 'windy_days' },
    },
    {
      title: `Was ${sj.season} a bad season?`,
      text: `The Index for the ${sj.season} season, the one right before the event, ranked ${ordinal(sj.rank)} of ${sj.of_years} years. The table checks every reported pile-up the same way.`,
      view: { selected: 'index', highlight: 'South Jordan' },
    },
    {
      title: 'Where do they pile up?',
      text: 'Green = where tumbleweeds grow (past sightings + open land). Red = where our model pushes them downwind, using real wind directions, until they hit buildings and fences. The yellow dot is Daybreak, on a built-up edge next to open land.',
      view: { focus: { lat: sj.lat, lon: sj.lon }, threshold: 12, layers: { sources: true, pileup: true } },
    },
    {
      title: 'What we can and cannot say',
      text: 'We show conditions and habitat, not individual plants. Wind data is ~50 km wide: regional seasons, not street paths. The 12 m/s threshold is an assumption (try the slider). The backtest is a plausibility check on a few events, not an accuracy score. Now try your own region!',
      view: { focus: null, highlight: null },
    },
  ] : []

  const cur = steps[step]
  useEffect(() => {
    if (!cur) return
    setView(cur.view)
    if (cur.view.highlight) document.getElementById('backtest')?.scrollIntoView({ behavior: 'smooth' })
  }, [step, !!cur])

  const err = [index, windy, bt].find((x) => x instanceof Error)
  return (
    <aside className="demo">
      {err ? <p className="error">{err.message}</p> : !cur ? <p>Loading demo data…</p> : (
        <>
          <span className="small">Guided demo · step {step + 1} of {steps.length}</span>
          <h3>{cur.title}</h3>
          <p>{cur.text}</p>
          <div className="row">
            <button disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            {step < steps.length - 1
              ? <button className="primary" onClick={() => setStep(step + 1)}>Next</button>
              : <button className="primary" onClick={() => setStep(null)}>Finish</button>}
          </div>
        </>
      )}
      <button className="close" onClick={() => setStep(null)} aria-label="Close demo">×</button>
    </aside>
  )
}
