import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { MapTileLayer } from './MapTileLayer';
import { MapResizeFix } from './MapResizeFix';
import { GAMBIA_CENTER } from '../lib/geolocation';
import { formatReportDateTime } from '../lib/date-range-presets';
import type { OfficerJourney } from '../lib/api';
import { cn } from '../lib/utils';
import { Clock, MapPin, Navigation, Route } from 'lucide-react';

function FitBounds({ points }: { points: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [48, 48], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [map, points]);
  return null;
}

/** Close tooltips and clear pin selection when user opens app chrome (menu, tabs, etc.). */
function MapInteractionDismiss({ onClearSelection }: { onClearSelection: () => void }) {
  const map = useMap();

  useEffect(() => {
    const closeTooltips = () => {
      map.eachLayer((layer) => {
        if ('closeTooltip' in layer && typeof layer.closeTooltip === 'function') {
          layer.closeTooltip();
        }
      });
      map.closePopup();
    };

    const dismiss = () => {
      closeTooltips();
      onClearSelection();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.officer-journey-map')) return;
      if (
        target.closest('[data-app-chrome]') ||
        target.closest('nav') ||
        target.closest('[role="dialog"]')
      ) {
        dismiss();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [map, onClearSelection]);

  return null;
}

type SelectedActivity =
  | { kind: 'visit'; id: number }
  | { kind: 'ping'; index: number }
  | null;

interface OfficerJourneyMapProps {
  journey: OfficerJourney | null;
  loading?: boolean;
  className?: string;
  /** Changes reset the activity panel (e.g. when report table tab changes). */
  interactionResetKey?: string;
}

function JourneyStatusChips({
  journey,
  hasTrackingPath,
  visitOnlyMode,
  noGeoData
}: {
  journey: OfficerJourney;
  hasTrackingPath: boolean;
  visitOnlyMode: boolean;
  noGeoData: boolean;
}) {
  const chipClass =
    'text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md border shadow-sm';

  return (
    <div className="flex flex-wrap gap-1.5">
      {visitOnlyMode && (
        <span className={cn(chipClass, 'bg-amber-50 border-amber-200 text-amber-800')}>
          Visit check-ins only
        </span>
      )}
      {noGeoData && (
        <span className={cn(chipClass, 'bg-slate-50 border-slate-200 text-slate-600')}>
          No GPS data
        </span>
      )}
      {hasTrackingPath && (
        <span className={cn(chipClass, 'bg-white border-slate-200 text-slate-600')}>
          {journey.distance_km} km tracked
        </span>
      )}
      {journey.sessions.length > 0 && (
        <span className={cn(chipClass, 'bg-white border-slate-200 text-slate-600')}>
          {journey.sessions.length} session{journey.sessions.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

export function OfficerJourneyMap({
  journey,
  loading,
  className,
  interactionResetKey
}: OfficerJourneyMapProps) {
  const [selected, setSelected] = useState<SelectedActivity>(null);

  useEffect(() => {
    setSelected(null);
  }, [journey?.date, journey?.officer.id]);

  useEffect(() => {
    setSelected(null);
  }, [interactionResetKey]);

  const pathPoints = useMemo(
    () => (journey?.path ?? []).map((p) => [p.lat, p.lng] as LatLngExpression),
    [journey]
  );

  const visitMarkers = useMemo(
    () =>
      (journey?.visits ?? []).filter(
        (v) => v.check_in_lat != null && v.check_in_lng != null
      ),
    [journey]
  );

  const visitPathPoints = useMemo(
    () =>
      [...visitMarkers]
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((v) => [v.check_in_lat!, v.check_in_lng!] as LatLngExpression),
    [visitMarkers]
  );

  const hasTrackingPath = pathPoints.length >= 2;
  const visitOnlyMode = !hasTrackingPath && visitMarkers.length > 0;
  const noGeoData =
    journey != null && !hasTrackingPath && visitMarkers.length === 0;

  const center = pathPoints[0] ?? visitMarkers[0]
    ? ([visitMarkers[0].check_in_lat!, visitMarkers[0].check_in_lng!] as LatLngExpression)
    : ([GAMBIA_CENTER.lat, GAMBIA_CENTER.lng] as LatLngExpression);

  const fitPoints = useMemo(() => {
    const pts: LatLngExpression[] = hasTrackingPath ? [...pathPoints] : [...visitPathPoints];
    if (hasTrackingPath) {
      for (const v of visitMarkers) {
        pts.push([v.check_in_lat!, v.check_in_lng!]);
      }
    }
    return pts;
  }, [hasTrackingPath, pathPoints, visitPathPoints, visitMarkers]);

  const selectedVisit =
    selected?.kind === 'visit'
      ? journey?.visits.find((v) => v.id === selected.id)
      : null;
  const selectedPing =
    selected?.kind === 'ping' ? journey?.path[selected.index] : null;

  if (loading) {
    return (
      <div
        className={cn(
          'officer-journey-map rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500 min-h-[280px]',
          className
        )}>
        Loading journey…
      </div>
    );
  }

  if (!journey) {
    return (
      <div
        className={cn(
          'officer-journey-map rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center px-6 min-h-[280px]',
          className
        )}>
        <Route className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm text-slate-600 font-medium">Officer journey map</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Select an officer and date from the work duration table to view GPS path,
          duty sessions, and visit check-ins.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'officer-journey-map rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col lg:flex-row min-h-[320px]',
        className
      )}>
      <div className="flex-1 min-h-[280px] relative z-0">
        <MapContainer
          center={center}
          zoom={13}
          className="h-full w-full min-h-[280px]"
          scrollWheelZoom>
          <MapTileLayer />
          <MapResizeFix />
          <MapInteractionDismiss onClearSelection={() => setSelected(null)} />
          <FitBounds points={fitPoints} />
          {hasTrackingPath && (
            <Polyline
              positions={pathPoints}
              pathOptions={{ color: '#1565C0', weight: 4, opacity: 0.85 }}
            />
          )}
          {visitOnlyMode && visitPathPoints.length >= 2 && (
            <Polyline
              positions={visitPathPoints}
              pathOptions={{
                color: '#00897B',
                weight: 3,
                opacity: 0.7,
                dashArray: '8 8'
              }}
            />
          )}
          {hasTrackingPath && pathPoints.length > 0 && (
            <CircleMarker
              center={pathPoints[0]}
              radius={8}
              pathOptions={{ color: '#22C55E', fillColor: '#22C55E', fillOpacity: 1 }}
              eventHandlers={{
                click: () => setSelected({ kind: 'ping', index: 0 })
              }}>
              <Tooltip direction="top" sticky={false}>
                Start
              </Tooltip>
            </CircleMarker>
          )}
          {hasTrackingPath && pathPoints.length > 1 && (
            <CircleMarker
              center={pathPoints[pathPoints.length - 1]}
              radius={8}
              pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 1 }}
              eventHandlers={{
                click: () =>
                  setSelected({ kind: 'ping', index: pathPoints.length - 1 })
              }}>
              <Tooltip direction="top" sticky={false}>
                Latest ping
              </Tooltip>
            </CircleMarker>
          )}
          {visitMarkers.map((v) => (
            <CircleMarker
              key={v.id}
              center={[v.check_in_lat!, v.check_in_lng!]}
              radius={10}
              pathOptions={{
                color: '#00897B',
                fillColor: '#00897B',
                fillOpacity: selected?.kind === 'visit' && selected.id === v.id ? 1 : 0.85,
                weight: selected?.kind === 'visit' && selected.id === v.id ? 3 : 2
              }}
              eventHandlers={{
                click: () => setSelected({ kind: 'visit', id: v.id })
              }}>
              <Tooltip direction="top" sticky={false}>
                {v.agent_name} · {v.time}
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <aside className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/80 p-4 flex flex-col gap-3 shrink-0 relative z-[1]">
        <div>
          <div className="text-sm font-semibold text-slate-900">{journey.officer.name}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {journey.date} · {journey.officer.zone || 'No zone'}
          </div>
          <div className="mt-2">
            <JourneyStatusChips
              journey={journey}
              hasTrackingPath={hasTrackingPath}
              visitOnlyMode={visitOnlyMode}
              noGeoData={noGeoData}
            />
          </div>
        </div>

        {visitOnlyMode && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
            Duty tracking was not active — map shows verified visit check-in locations
            {visitPathPoints.length >= 2 ? ' connected in visit order.' : '.'}
          </p>
        )}
        {noGeoData && journey.visits.length > 0 && (
          <p className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-2">
            {journey.visits.length} visit{journey.visits.length !== 1 ? 's' : ''} logged but no
            GPS coordinates were captured.
          </p>
        )}

        <div className="space-y-2 text-xs">
          <div className="font-semibold text-slate-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Duty sessions
          </div>
          {journey.sessions.length === 0 ? (
            <p className="text-slate-500">No duty sessions recorded this day.</p>
          ) : (
            journey.sessions.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-2">
                <div className="font-medium text-slate-800">
                  {formatReportDateTime(s.started_at)}
                  {s.active ? ' · on duty' : ''}
                </div>
                {s.ended_at && (
                  <div className="text-slate-500 mt-0.5">
                    Ended {formatReportDateTime(s.ended_at)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          <div className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5" />
            Activity
          </div>
          {selectedVisit ? (
            <div className="bg-white border border-teal-200 rounded-lg p-3 text-xs">
              <div className="font-semibold text-slate-900">{selectedVisit.agent_name}</div>
              <div className="text-slate-600 mt-1">{selectedVisit.type}</div>
              <div className="text-slate-500 mt-1">Check-in {selectedVisit.time}</div>
              {selectedVisit.gps_verified && (
                <div className="text-apsGreen mt-1">
                  GPS verified · {selectedVisit.distance_meters}m
                </div>
              )}
            </div>
          ) : selectedPing ? (
            <div className="bg-white border border-blue-200 rounded-lg p-3 text-xs">
              <div className="font-semibold text-slate-900 capitalize">
                {selectedPing.source.replace('_', ' ')}
              </div>
              <div className="text-slate-500 mt-1">
                {formatReportDateTime(selectedPing.captured_at)}
              </div>
              {selectedPing.accuracy != null && (
                <div className="text-slate-500 mt-0.5">
                  ±{Math.round(selectedPing.accuracy)}m
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Click a visit marker or path point on the map for details.
            </p>
          )}

          <div className="font-semibold text-slate-700 text-xs flex items-center gap-1.5 pt-2">
            <MapPin className="w-3.5 h-3.5" />
            Visits ({journey.visits.length})
          </div>
          <ul className="space-y-1">
            {journey.visits.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => setSelected({ kind: 'visit', id: v.id })}
                  className={cn(
                    'w-full text-left text-xs px-2 py-1.5 rounded-md border transition-colors',
                    selected?.kind === 'visit' && selected.id === v.id
                      ? 'bg-teal-50 border-teal-200 text-teal-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  )}>
                  <span className="font-medium">{v.time}</span> · {v.agent_name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
