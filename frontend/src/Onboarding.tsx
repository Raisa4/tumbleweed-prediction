import { useState } from 'react'
import { Region } from './api'

export type Role = 'city' | 'farmer' | 'student'

const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: 'city', label: 'City, road crew or fire district', hint: 'See where tumbleweeds will pile up, so you can clear or mow before a wind event.' },
  { id: 'farmer', label: 'Farmer or landowner', hint: 'See where seed sources are, so you can mow before plants set seed.' },
  { id: 'student', label: 'Student or curious', hint: 'Explore 25 years of NASA data and test whether trends are real.' },
]

export function Onboarding({ regions, onStart, onDemo }: {
  regions: Region[]; onStart: (role: Role, region: string) => void; onDemo: () => void
}) {
  const [role, setRole] = useState<Role | null>(null)
  const [region, setRegion] = useState<string | null>(null)
  return (
    <main className="onboard">
      <h1>Tumbleweed Trend Detective</h1>
      <p className="lead">
        Every few years, wind rolls thousands of tumbleweeds into western US towns and highways. Are the conditions
        behind it getting worse? We test 25 years of NASA satellite and model data to find out.
      </p>
      <h2>Who are you?</h2>
      <div className="choices">
        {ROLES.map((r) => (
          <button key={r.id} className={role === r.id ? 'chosen' : ''} onClick={() => setRole(r.id)}>
            <strong>{r.label}</strong><span>{r.hint}</span>
          </button>
        ))}
      </div>
      <h2>Where?</h2>
      <div className="choices">
        {regions.map((r) => (
          <button key={r.id} className={region === r.id ? 'chosen' : ''} onClick={() => setRegion(r.id)}>
            <strong>{r.name}</strong>
          </button>
        ))}
      </div>
      <div className="row">
        <button className="primary" disabled={!role || !region} onClick={() => onStart(role!, region!)}>Start exploring</button>
        <button onClick={onDemo}>Watch the guided demo: why South Jordan got buried in 2024</button>
      </div>
    </main>
  )
}
