import React, { useCallback, useEffect, useState } from 'react';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { MapTileLayer } from './MapTileLayer';
import { MapResizeFix } from './MapResizeFix';
import L from 'leaflet';
import { Crosshair, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import {
  canUseDeviceGps,
  captureDeviceLocation,
  formatCoords,
  GAMBIA_CENTER,
  type GeoCoords
} from '../lib/geolocation';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow
});

interface LocationPickerProps {
  value: GeoCoords | null;
  onChange: (coords: GeoCoords) => void;
  className?: string;
  mapHeightClass?: string;
  autoCapture?: boolean;
}

function MapViewSync({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

function MapClickToPlace({ onPick }: { onPick: (coords: GeoCoords) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

export function LocationPicker({
  value,
  onChange,
  className,
  mapHeightClass = 'h-52',
  autoCapture = false
}: LocationPickerProps) {
  const [locating, setLocating] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const gpsAvailable = canUseDeviceGps();

  const center: [number, number] = value
    ? [value.lat, value.lng]
    : [GAMBIA_CENTER.lat, GAMBIA_CENTER.lng];
  const zoom = value ? 15 : 10;

  const useDeviceGps = useCallback(async () => {
    setLocating(true);
    try {
      const coords = await captureDeviceLocation();
      onChange(coords);
      toast.success('Location captured', {
        description: formatCoords(coords)
      });
    } catch (err) {
      toast.error('Could not use device GPS', {
        description: err instanceof Error ? err.message : 'Try placing the pin on the map'
      });
    } finally {
      setLocating(false);
    }
  }, [onChange]);

  useEffect(() => {
    if (!autoCapture || autoTried || value) return;
    setAutoTried(true);
    if (gpsAvailable) void useDeviceGps();
  }, [autoCapture, autoTried, value, gpsAvailable, useDeviceGps]);

  return (
    <div className={cn('space-y-3', className)}>
      {!gpsAvailable && (
        <div className="rounded-lg border border-apsAmber/30 bg-apsAmberLt/40 px-3 py-2.5 text-xs text-slate-700">
          <span className="font-semibold">GPS unavailable on this connection.</span>{' '}
          Tap the map to place the agent&apos;s shop location, or open the app via{' '}
          <span className="font-mono">localhost</span> / HTTPS to use device GPS.
        </div>
      )}

      <div
        className={cn(
          'rounded-xl overflow-hidden border border-slate-200 shadow-sm',
          mapHeightClass
        )}>
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom
          className="h-full w-full">
          <MapTileLayer />
          <MapViewSync center={center} zoom={zoom} />
          <MapResizeFix />
          <MapClickToPlace onPick={onChange} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  onChange({ lat, lng });
                }
              }}
            />
          )}
        </MapContainer>
      </div>

      {value ? (
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-900">
          <MapPin className="w-4 h-4 text-apsBlue shrink-0" />
          {formatCoords(value)}
        </div>
      ) : (
        <p className="text-xs text-center text-slate-500">
          Tap the map to set the agent&apos;s location
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={useDeviceGps}
          disabled={locating || !gpsAvailable}
          className="flex-1 flex items-center justify-center gap-2 bg-apsBlue hover:bg-apsBlueMid text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {locating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Crosshair className="w-4 h-4" />
          )}
          {locating ? 'Capturing…' : value ? 'Re-capture GPS' : 'Use my GPS'}
        </button>
      </div>
    </div>
  );
}
