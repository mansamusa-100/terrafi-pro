import { useEffect, useState } from 'react';
import { captureDeviceLocation, type GeoCoords } from './geolocation';

/** Captures the user's GPS once on mount (for distance sorting). */
export function useUserLocation() {
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    captureDeviceLocation()
      .then((c) => {
        if (!cancelled) setCoords(c);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { coords, loading };
}
