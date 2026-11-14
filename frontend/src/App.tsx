import { useState } from 'react'
import { BacktestRow, Region, urls, useJson, usingFixtures } from './api'
import { Backtest } from './Backtest'
import { Demo } from './Demo'
import { Focus, Layers, MapView } from './MapView'
import { Onboarding, Role } from './Onboarding'
import { TrendPanel } from './TrendPanel'

export type View = {
  region: string; selected: string | null; threshold: number; layers: Layers; focus: Focus; highlight: string | null
}

const ROLE_VIEW: Record<Role, Pick<View, 'selected' | 'layers'>> = {
  city: { selected: null, layers: { sources: false, pileup: true } },
  farmer: { selected: null, layers: { sources: true, pileup: false } },
  student: { selected: 'index', layers: { sources: true, pileup: true } },
}

export default function App() {
  const regions = useJson<Region[]>(urls.regions())
  const [role, setRole] = useState<Role | null>(null)
  const [demo, setDemo] = useState<number | null>(null)
  const [view, setFull] = useState<View>({
    region: 'salt_lake_valley', selected: 'index', threshold: 12, layers: ROLE_VIEW.student.layers, focus: null, highlight: null,
  })
  const setView = (v: Partial<View>) => setFull((cur) => ({ ...cur, ...v }))
  const backtest = useJson<BacktestRow[]>(urls.backtest(view.region))

  if (regions instanceof Error) return <p className="error">{regions.message}</p>
  if (!regions) return <p>Loading…</p>
  const start = (r: Role, region: string) => { setRole(r); setView({ region, focus: null, ...ROLE_VIEW[r] }) }
  if (!role && demo === null) return <Onboarding regions={regions} onStart={start} onDemo={() => { start('student', 'salt_lake_valley'); setDemo(0) }} />

  const region = regions.find((r) => r.id === view.region)!
  const events = backtest && !(backtest instanceof Error) ? backtest : []
  return (
    <>
      <header>
        <strong className="brand" onClick={() => setRole(null)}>Tumbleweed Trend Detective</strong>
        <select value={view.region} onChange={(e) => setView({ region: e.target.value, focus: null, highlight: null })}>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button className="primary" onClick={() => setDemo(0)}>Guided demo</button>
      </header>
      {usingFixtures && <p className="banner">Showing placeholder numbers (fixtures), not real NASA data yet.</p>}
      {backtest instanceof Error && <p className="error">{backtest.message}</p>}
      <div className={`layout ${role === 'student' ? '' : 'map-first'}`}>
        <div className="left">
          <TrendPanel region={view.region} selected={view.selected} onSelect={(selected) => setView({ selected })}
            eventSeasons={[...new Set(events.map((e) => e.season))]} />
          <Backtest rows={events} highlight={view.highlight} />
        </div>
        <div className="right">
          <MapView region={region} events={events} threshold={view.threshold} setThreshold={(threshold) => setView({ threshold })}
            layers={view.layers} setLayers={(layers) => setView({ layers })} focus={view.focus} />
        </div>
      </div>
      {demo !== null && <Demo step={demo} setStep={setDemo} setView={setView} />}
      <footer className="small">
        Data: NASA GPM IMERG, MODIS MOD13Q1 & MCD12Q1, GLDAS Noah, MERRA-2; sightings from GBIF and iNaturalist; map © OpenStreetMap.
        Satellites can't see individual tumbleweeds: we model the conditions and habitat they need.
      </footer>
    </>
  )
}
