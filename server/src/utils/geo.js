/** Haversine distance in km */
export function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** ETA from remaining distance assuming average ground speed km/h */
export function etaFromRemainingKm(remainingKm, avgSpeedKmh = 45) {
  if (remainingKm <= 0 || !avgSpeedKmh) return new Date();
  const hours = remainingKm / avgSpeedKmh;
  return new Date(Date.now() + hours * 3600 * 1000);
}

/** Interpolate position along great-circle path t in [0,1] */
export function interpolateAlongRoute(origin, dest, t) {
  const tt = Math.min(1, Math.max(0, t));
  const lat = origin.lat + (dest.lat - origin.lat) * tt;
  const lng = origin.lng + (dest.lng - origin.lng) * tt;
  return { lat, lng };
}
