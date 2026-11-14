import { useEffect } from 'react'
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type { Feature, FeatureCollection } from 'geojson'
import { BacktestRow, Region, ordinal, urls, useJson } from './api'

export type Layers = { sources: boolean; pileup: boolean }
export type Focus = { lat: number; lon: number } | null

function Fit({ region, focus }: { region: Region; focus: Focus }) {
  const map = useMap()
  useEffect(() => {
    const [w, s, e, n] = region.bbox
    if (focus) map.flyTo([focus.lat, focus.lon], 14)
    else map.fitBounds([[s, w], [n, e]])
  }, [map, region, focus])
  return null
}

function Layer({ url, prop, color }: { url: string; prop: string; color: string }) {
  const d = useJson<FeatureCollection>(url)
  if (!d || d instanceof Error) return null
  return (
    <GeoJSON key={url} data={d} style={(f?: Feature) => ({
      stroke: false, fillColor: color, fillOpacity: 0.15 + 0.6 * (f?.properties?.[prop] ?? 0),
    })} />
  )
}

export function MapView({ region, events, threshold, setThreshold, layers, setLayers, focus }: {
  region: Region; events: BacktestRow[]; threshold: number; setThreshold: (t: number) => void
  layers: Layers; setLayers: (l: Layers) => void; focus: Focus
}) {
  return (
    <section className="mapwrap">
      <div className="map-controls">
        <label>
          <input type="checkbox" checked={layers.sources} onChange={(e) => setLayers({ ...layers, sources: e.target.checked })} />
          <i className="sw src" /> Where tumbleweeds grow (sightings + open land)
        </label>
        <label>
          <input type="checkbox" checked={layers.pileup} onChange={(e) => setLayers({ ...layers, pileup: e.target.checked })} />
          <i className="sw pile" /> Where wind piles them up (against buildings, fences)
        </label>
        <span><i className="sw ev" /> Real reported pile-ups</span>
        <label className="slider">
          Wind needed to roll a tumbleweed: <strong>{threshold} m/s ({Math.round(threshold * 2.237)} mph)</strong>
          <input type="range" min={8} max={16} step={2} value={threshold} onChange={(e) => setThreshold(+e.target.value)} />
          <span className="small">This threshold is an assumption, not a measurement. Move it and see how the pile-up zones change.</span>
        </label>
      </div>
      <MapContainer className="map" preferCanvas center={[0, 0]} zoom={2}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit region={region} focus={focus} />
        {layers.sources && <Layer url={urls.sources(region.id)} prop="weight" color="#2e9d4a" />}
        {layers.pileup && <Layer url={urls.pileup(region.id, threshold)} prop="risk" color="#d7301f" />}
        {events.map((e) => (
          <CircleMarker key={e.date + e.place} center={[e.lat, e.lon]} radius={9}
            pathOptions={{ color: '#000', weight: 1.5, fillColor: '#ffd21f', fillOpacity: 1 }}>
            <Popup>
              <strong>{e.date}</strong><br />{e.place}<br />
              Index for the {e.season} season ranked {ordinal(e.rank)} of {e.of_years} years.<br />
              <a href={e.source_url} target="_blank" rel="noreferrer">News source</a>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <p className="small">
        Wind directions come from MERRA-2 (~50 km cells): they describe the regional wind season, not street-by-street paths.
      </p>
    </section>
  )
}
