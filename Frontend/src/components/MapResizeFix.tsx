import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/** Leaflet often mis-sizes inside flex/grid layouts until invalidateSize runs. */
export function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(t);
  }, [map]);
  return null;
}
