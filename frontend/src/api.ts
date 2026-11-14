import { useEffect, useState } from 'react'

const API: string = import.meta.env.VITE_API ?? 'fixtures'
export const usingFixtures = API === 'fixtures'
const F = '/fixtures'

export type Region = { id: string; name: string; bbox: [number, number, number, number] }
export type Trend = {
  region: string; var: string; years: number[]; values: number[]
  slope: number; ci_low: number; ci_high: number; p: number
  trend: 'increasing' | 'decreasing' | 'no trend'; significant: boolean; verdict: string
}
export type BacktestRow = {
  date: string; place: string; index_value: number; rank: number; of_years: number
  lat: number; lon: number; source_url: string; season: number
}

export const urls = {
  regions: () => (usingFixtures ? `${F}/regions.json` : `${API}/regions`),
  trend: (r: string, v: string) =>
    v === 'index'
      ? usingFixtures ? `${F}/index/${r}.json` : `${API}/index?region=${r}`
      : usingFixtures ? `${F}/trend/${r}/${v}.json` : `${API}/trend?region=${r}&var=${v}`,
  backtest: (r: string) => (usingFixtures ? `${F}/backtest/${r}.json` : `${API}/backtest?region=${r}`),
  sources: (r: string) => `${usingFixtures ? `${F}/layers` : `${API}/layers`}/${r}/sources.geojson`,
  pileup: (r: string, t: number) =>
    usingFixtures ? `${F}/layers/${r}/pileup_${t}.geojson` : `${API}/layers/${r}/pileup.geojson?threshold=${t}`,
}

/** Fetch JSON; returns data, or an Error to show, or null while loading. */
export function useJson<T>(url: string): T | Error | null {
  const [state, setState] = useState<{ url: string; v: T | Error } | null>(null)
  useEffect(() => {
    let live = true
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} from ${url}`))))
      .then((v) => live && setState({ url, v }), (e: Error) => live && setState({ url, v: e }))
    return () => { live = false }
  }, [url])
  return state?.url === url ? state.v : null
}

const SUFFIX = ['th', 'st', 'nd', 'rd']
export const ordinal = (n: number) => n + (SUFFIX[((n % 100) - 20) % 10] ?? SUFFIX[n % 100] ?? 'th')
export const fmt = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : Number(x.toPrecision(3)).toString())
