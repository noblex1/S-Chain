import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.length === 2) {
      map.fitBounds(bounds, { padding: [48, 48], animate: true, maxZoom: 12 });
    }
  }, [bounds, map]);
  return null;
}

/**
 * Straight-line route (great-circle approximation for short hops shown as polyline).
 * For “shortest path” UX we use geodesic-style intermediate points.
 */
function routePoints(origin, dest, steps = 24) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([origin.lat + (dest.lat - origin.lat) * t, origin.lng + (dest.lng - origin.lng) * t]);
  }
  return pts;
}

export default function LiveMap({ origin, destination, current, height = 420 }) {
  const center = useMemo(() => {
    const cur = current || origin;
    return [cur.lat, cur.lng];
  }, [current, origin]);

  const line = useMemo(() => routePoints(origin, destination), [origin, destination]);

  /* Fit to corridor only so live position updates do not re-zoom the map */
  const bounds = useMemo(() => {
    const lats = [origin.lat, destination.lat];
    const lngs = [origin.lng, destination.lng];
    return [
      [Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05],
      [Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05],
    ];
  }, [origin, destination]);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner" style={{ height }}>
      <MapContainer
        center={center}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />
        <Polyline positions={line} pathOptions={{ color: '#1482e1', weight: 4, opacity: 0.85 }} />
        <Marker position={[origin.lat, origin.lng]}>
          <Popup>Origin</Popup>
        </Marker>
        <Marker position={[destination.lat, destination.lng]}>
          <Popup>Destination</Popup>
        </Marker>
        {current && (
          <CircleMarker
            center={[current.lat, current.lng]}
            radius={12}
            pathOptions={{
              color: '#0d9488',
              fillColor: '#14b8a6',
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>Current position</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
