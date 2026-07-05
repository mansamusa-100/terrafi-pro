export const GAMBIA_CENTER = { lat: 13.45, lng: -16.35 } as const;

export type GeoCoords = { lat: number; lng: number };

export function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function canUseDeviceGps(): boolean {
  return isGeolocationSupported() && isSecureContext();
}

const ERROR_MESSAGES: Record<number, string> = {
  1: 'Location permission denied. Allow location access in your browser settings, or place the pin on the map.',
  2: 'Position unavailable. Try moving outdoors or place the pin on the map manually.',
  3: 'Location request timed out. Try again or place the pin on the map.'
};

export function geolocationErrorMessage(error: GeolocationPositionError): string {
  return ERROR_MESSAGES[error.code] ?? error.message ?? 'Could not get location';
}

function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/** Try high-accuracy GPS first, then fall back to network/cached position. */
export async function captureDeviceLocation(): Promise<GeoCoords> {
  if (!isGeolocationSupported()) {
    throw new Error('Geolocation is not supported in this browser');
  }
  if (!isSecureContext()) {
    throw new Error(
      'Device GPS requires a secure connection (HTTPS or localhost). Place the pin on the map instead.'
    );
  }

  const attempts: PositionOptions[] = [
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 }
  ];

  let lastError: GeolocationPositionError | null = null;
  for (const options of attempts) {
    try {
      const pos = await getPosition(options);
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        lastError = err;
        if (err.code === 1) break;
      } else {
        throw err;
      }
    }
  }

  throw new Error(
    lastError ? geolocationErrorMessage(lastError) : 'Could not capture location'
  );
}

export function formatCoords(coords: GeoCoords): string {
  const latHem = coords.lat >= 0 ? 'N' : 'S';
  const lngHem = coords.lng >= 0 ? 'E' : 'W';
  return `${Math.abs(coords.lat).toFixed(4)}°${latHem}, ${Math.abs(coords.lng).toFixed(4)}°${lngHem}`;
}
