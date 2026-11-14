import { useEffect, type ReactNode } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  Popup,
  Rectangle,
  TileLayer,
  useMap,
} from "react-leaflet";
import L, { type Map as LeafletMap } from "leaflet";
import type { BacktestRow, Cells, Points, Region } from "./api";
import { RISK_CLASSES, SOURCE_CLASSES, fmt, riskColour, sourceColour } from "./vars";

export type Basemap = "streets" | "satellite";

const TILES: Record<Basemap, { base: string; labels: string | null; credit: string }> = {
  // Esri World Street Map: coloured (parks, water, roads), free, no API key. Labels are already in the tiles.
  streets: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    labels: null,
    credit: "Basemap &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
  },
  satellite: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labels:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    credit: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
  },
};

function Fit({ bbox, onReady }: { bbox: Region["bbox"]; onReady: (m: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds(bbox));
    onReady(map);
  }, [map, bbox, onReady]);
  return null;
}

export const bounds = (b: Region["bbox"]): [[number, number], [number, number]] => [
  [b[1], b[0]],
  [b[3], b[2]],
];

export function Tiles({ basemap }: { basemap: Basemap }) {
  const t = TILES[basemap];
  return (
    <>
      <TileLayer key={basemap} url={t.base} attribution={t.credit} maxNativeZoom={16} />
      {/* Separate label layer on top of our data, only for basemaps whose tiles have no labels. */}
      {t.labels && (
        <Pane name="labels" style={{ zIndex: 450, pointerEvents: "none" }}>
          <TileLayer key={basemap + "-labels"} url={t.labels} maxNativeZoom={16} />
        </Pane>
      )}
    </>
  );
}

export function StudyArea({ bbox }: { bbox: Region["bbox"] }) {
  return (
    <Rectangle
      bounds={bounds(bbox)}
      pathOptions={{ color: "#33190A", weight: 1.5, dashArray: "6 6", fill: false }}
      interactive={false}
    />
  );
}

export function BaseMap({
  region,
  className,
  onReady,
  children,
}: {
  region: Region;
  className: string;
  onReady: (m: LeafletMap) => void;
  children: ReactNode;
}) {
  return (
    <MapContainer className={className} preferCanvas scrollWheelZoom={false} zoomSnap={0.25}>
      <Fit bbox={region.bbox} onReady={onReady} />
      <Tiles basemap="streets" />
      <StudyArea bbox={region.bbox} />
      {children}
    </MapContainer>
  );
}

export function SourceLayer({ data }: { data: Cells }) {
  return (
    <GeoJSON
      data={data}
      style={(f) => ({
        fillColor: sourceColour(f?.properties.weight ?? 0),
        fillOpacity: 0.55,
        stroke: false,
      })}
      onEachFeature={(f, l) =>
        l.bindTooltip(
          `<b>Seed source</b><br>${SOURCE_CLASSES.find((c) => c.test(f.properties.weight))!.label}`,
          { sticky: true },
        )
      }
    />
  );
}

export function PileupLayer({ data }: { data: Cells }) {
  return (
    <GeoJSON
      data={data}
      // Draw only real risk (from the first colour class up); the faint cells covered the whole map.
      filter={(f) => f.properties.risk >= RISK_CLASSES[0].min}
      style={(f) => ({ fillColor: riskColour(f?.properties.risk ?? 0), fillOpacity: 0.8, stroke: false })}
      onEachFeature={(f, l) =>
        l.bindTooltip(`<b>Pile-up risk ${fmt(f.properties.risk, 2)}</b> on a 0–1 scale`, {
          sticky: true,
        })
      }
    />
  );
}

// A real, news-reported pile-up: dark dot with a pulsing ring (animation in styles.css).
const NEWS_ICON = L.divIcon({
  className: "news",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -10],
  html: '<span class="ring"></span><span class="core">!</span>',
});

export function EventMarkers({ events }: { events: BacktestRow[] }) {
  return (
    <>
      {events.map((e) =>
        e.lat == null || e.lon == null ? null : (
          <Marker key={e.date + e.place} position={[e.lat, e.lon]} icon={NEWS_ICON} zIndexOffset={1000}>
            <Popup>
              <strong>{e.place}</strong>
              <br />
              {e.date} · season {e.season}
              <br />
              Index that season ranked <b>{e.rank}</b> of {e.of_years} (1 = worst)
              {e.source_url && (
                <>
                  <br />
                  <a href={e.source_url} target="_blank" rel="noreferrer">
                    Read the news report
                  </a>
                </>
              )}
            </Popup>
          </Marker>
        ),
      )}
    </>
  );
}

export function SightingDots({ data }: { data: Points }) {
  return (
    <>
      {data.features.map((f) => (
        <CircleMarker
          key={f.properties.id}
          center={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
          radius={5}
          pathOptions={{ color: "#fff", weight: 1.5, fillColor: "#5B2C83", fillOpacity: 1 }}
        >
          <Popup>
            <strong>{f.properties.taxon}</strong>
            <br />
            {f.properties.source} · {f.properties.quality}
            <br />
            <a href={f.properties.id} target="_blank" rel="noreferrer">
              See the record
            </a>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

export function RiskScale() {
  return (
    <div className="scale">
      <div className="scale-bar">
        {RISK_CLASSES.map((c) => (
          <span key={c.colour} style={{ background: c.colour }} />
        ))}
      </div>
      <div className="scale-ends">
        <span>Low</span>
        <span>Highest</span>
      </div>
    </div>
  );
}

export function BasemapSwitch({
  value,
  onChange,
}: {
  value: Basemap;
  onChange: (b: Basemap) => void;
}) {
  return (
    <div className="seg" role="group" aria-label="Background map">
      {(["streets", "satellite"] as const).map((b) => (
        <button key={b} aria-pressed={value === b} onClick={() => onChange(b)}>
          {b === "streets" ? "Map" : "Satellite"}
        </button>
      ))}
    </div>
  );
}
