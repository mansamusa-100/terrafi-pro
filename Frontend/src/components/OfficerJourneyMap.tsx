import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { MapTileLayer } from './MapTileLayer';
import { MapResizeFix } from './MapResizeFix';
import { MapInteractionDismiss } from './MapInteractionDismiss';
import { GAMBIA_CENTER } from '../lib/geolocation';
import { formatReportDateTime } from '../lib/date-range-presets';
import type { OfficerJourney } from '../lib/api';
import {
  buildJourneyTimeline,
  pathUpToTime,
  stopKindLabel,
  type JourneyTimelineStop
} from '../lib/journey-timeline';
import {
  isEndStop,
  isStartStop,
  journeyEndIcon,
  journeyHeadIcon,
  journeyStartIcon,
  journeyVisitIcon
} from '../lib/journey-map-icons';
import { cn } from '../lib/utils';
import {
  Clock,
  MapPin,
  Navigation,
  Pause,
  Play,
  Route,
  SkipBack,
  SkipForward
} from 'lucide-react';

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

interface OfficerJourneyMapProps {
  journey: OfficerJourney | null;
  loading?: boolean;
  className?: string;
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

function visitReachedIndex(timeline: JourneyTimelineStop[], stopIndex: number, visitId: number) {
  return timeline.findIndex((s, i) => i <= stopIndex && s.visitId === visitId);
}

function JourneyPlaybackControls({
  timeline,
  stopIndex,
  playing,
  onStopIndexChange,
  onPlay,
  onPause,
  onStepBack,
  onStepForward
}: {
  timeline: JourneyTimelineStop[];
  stopIndex: number;
  playing: boolean;
  onStopIndexChange: (index: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
}) {
  if (timeline.length < 2) return null;

  const current = timeline[stopIndex];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Journey playback
        </div>
        <span className="text-[10px] text-slate-400 tabular-nums">
          {stopIndex + 1} / {timeline.length}
        </span>
      </div>

      {current && (
        <div className="rounded-md bg-slate-50 border border-slate-100 px-2.5 py-2 text-xs">
          <div className="font-semibold text-slate-900">{current.title}</div>
          <div className="text-slate-500 mt-0.5">
            {stopKindLabel(current.kind)} · {formatReportDateTime(current.at)}
          </div>
          {current.subtitle && (
            <div className="text-slate-500 mt-0.5 truncate">{current.subtitle}</div>
          )}
        </div>
      )}

      <input
        type="range"
        min={0}
        max={timeline.length - 1}
        value={stopIndex}
        onChange={(e) => {
          onPause();
          onStopIndexChange(Number.parseInt(e.target.value, 10));
        }}
        className="w-full h-1.5 accent-apsBlue cursor-pointer"
        aria-label="Journey timeline scrubber"
      />

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={onStepBack}
          disabled={stopIndex === 0}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Previous stop">
          <SkipBack className="w-4 h-4" />
        </button>
        {playing ? (
          <button
            type="button"
            onClick={onPause}
            className="p-2.5 rounded-lg bg-apsBlue text-white hover:bg-apsBlue/90"
            aria-label="Pause playback">
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onPlay}
            className="p-2.5 rounded-lg bg-apsBlue text-white hover:bg-apsBlue/90"
            aria-label="Play journey">
            <Play className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onStepForward}
          disabled={stopIndex >= timeline.length - 1}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Next stop">
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[10px] text-slate-500 leading-relaxed">
        Green <strong>S</strong> = duty start · numbered stops = visits in order · red{' '}
        <strong>E</strong> = duty end. The blue line grows as the officer moves.
      </p>
    </div>
  );
}

export function OfficerJourneyMap({
  journey,
  loading,
  className,
  interactionResetKey
}: OfficerJourneyMapProps) {
  const [stopIndex, setStopIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const timeline = useMemo(
    () => (journey ? buildJourneyTimeline(journey) : []),
    [journey]
  );

  useEffect(() => {
    setPlaying(false);
    setStopIndex(timeline.length > 0 ? timeline.length - 1 : 0);
  }, [journey?.date, journey?.officer.id, timeline.length, interactionResetKey]);

  useEffect(() => {
    if (!playing || timeline.length < 2) return;
    const timer = window.setInterval(() => {
      setStopIndex((prev) => {
        if (prev >= timeline.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [playing, timeline.length]);

  const currentStop = timeline[stopIndex] ?? null;

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

  const sortedVisits = useMemo(
    () => [...visitMarkers].sort((a, b) => a.time.localeCompare(b.time)),
    [visitMarkers]
  );

  const hasTrackingPath = pathPoints.length >= 2;
  const visitOnlyMode = !hasTrackingPath && visitMarkers.length > 0;
  const noGeoData =
    journey != null && !hasTrackingPath && visitMarkers.length === 0;

  const activePathPoints = useMemo(() => {
    if (!journey || !currentStop) return [];
    if (hasTrackingPath) {
      return pathUpToTime(journey.path, currentStop.at).map(
        (p) => [p.lat, p.lng] as LatLngExpression
      );
    }
    if (visitOnlyMode) {
      const cutoff = currentStop.at;
      return sortedVisits
        .filter((v) => {
          const ts = `${journey.date}T${v.time}:00`;
          return Date.parse(ts) <= Date.parse(cutoff);
        })
        .map((v) => [v.check_in_lat!, v.check_in_lng!] as LatLngExpression);
    }
    return [];
  }, [journey, currentStop, hasTrackingPath, visitOnlyMode, sortedVisits]);

  const visitPathPoints = useMemo(
    () =>
      sortedVisits.map((v) => [v.check_in_lat!, v.check_in_lng!] as LatLngExpression),
    [sortedVisits]
  );

  const center =
    pathPoints[0] ??
    (visitMarkers[0]
      ? ([visitMarkers[0].check_in_lat!, visitMarkers[0].check_in_lng!] as LatLngExpression)
      : ([GAMBIA_CENTER.lat, GAMBIA_CENTER.lng] as LatLngExpression));

  const fitPoints = useMemo(() => {
    const pts: LatLngExpression[] = hasTrackingPath ? [...pathPoints] : [...visitPathPoints];
    if (hasTrackingPath) {
      for (const v of visitMarkers) {
        pts.push([v.check_in_lat!, v.check_in_lng!]);
      }
    }
    return pts;
  }, [hasTrackingPath, pathPoints, visitPathPoints, visitMarkers]);

  const startPlay = () => {
    setStopIndex(0);
    setPlaying(true);
  };

  if (loading) {
    return (
      <div
        className={cn(
          'app-map officer-journey-map rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500 min-h-[280px]',
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
          'app-map officer-journey-map rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center px-6 min-h-[280px]',
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
        'app-map officer-journey-map rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col lg:flex-row min-h-[320px]',
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
          <MapInteractionDismiss />
          <FitBounds points={fitPoints} />

          {hasTrackingPath && pathPoints.length >= 2 && (
            <Polyline
              positions={pathPoints}
              pathOptions={{ color: '#94A3B8', weight: 3, opacity: 0.35, dashArray: '6 8' }}
            />
          )}
          {visitOnlyMode && visitPathPoints.length >= 2 && (
            <Polyline
              positions={visitPathPoints}
              pathOptions={{ color: '#94A3B8', weight: 3, opacity: 0.35, dashArray: '6 8' }}
            />
          )}

          {activePathPoints.length >= 2 && (
            <Polyline
              positions={activePathPoints}
              pathOptions={{ color: '#1565C0', weight: 5, opacity: 0.9 }}
            />
          )}

          {timeline.map((stop) => {
            if (isStartStop(stop)) {
              return (
                <Marker
                  key={stop.id}
                  position={[stop.lat, stop.lng]}
                  icon={journeyStartIcon()}
                  eventHandlers={{
                    click: () => {
                      const idx = timeline.findIndex((s) => s.id === stop.id);
                      if (idx >= 0) {
                        setPlaying(false);
                        setStopIndex(idx);
                      }
                    }
                  }}>
                  <Tooltip direction="top" sticky={false}>
                    Start · {formatReportDateTime(stop.at)}
                  </Tooltip>
                </Marker>
              );
            }
            if (isEndStop(stop)) {
              const reached = timeline.findIndex((s) => s.id === stop.id) <= stopIndex;
              if (!reached) return null;
              return (
                <Marker
                  key={stop.id}
                  position={[stop.lat, stop.lng]}
                  icon={journeyEndIcon()}
                  eventHandlers={{
                    click: () => {
                      const idx = timeline.findIndex((s) => s.id === stop.id);
                      if (idx >= 0) {
                        setPlaying(false);
                        setStopIndex(idx);
                      }
                    }
                  }}>
                  <Tooltip direction="top" sticky={false}>
                    End · {formatReportDateTime(stop.at)}
                  </Tooltip>
                </Marker>
              );
            }
            if (stop.kind === 'visit' && stop.visitOrder != null) {
              const stopIdx = timeline.findIndex((s) => s.id === stop.id);
              const reached = stopIdx <= stopIndex;
              const active = stopIdx === stopIndex;
              return (
                <Marker
                  key={stop.id}
                  position={[stop.lat, stop.lng]}
                  icon={journeyVisitIcon(stop.visitOrder, active, reached)}
                  eventHandlers={{
                    click: () => {
                      setPlaying(false);
                      setStopIndex(stopIdx);
                    }
                  }}>
                  <Tooltip direction="top" sticky={false}>
                    {stop.visitOrder}. {stop.title} · {stop.subtitle}
                  </Tooltip>
                </Marker>
              );
            }
            return null;
          })}

          {currentStop && playing && (
            <Marker
              position={[currentStop.lat, currentStop.lng]}
              icon={journeyHeadIcon()}
              zIndexOffset={1000}
            />
          )}
        </MapContainer>
      </div>

      <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/80 p-4 flex flex-col gap-3 shrink-0 relative z-[1]">
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

        <JourneyPlaybackControls
          timeline={timeline}
          stopIndex={stopIndex}
          playing={playing}
          onStopIndexChange={setStopIndex}
          onPlay={startPlay}
          onPause={() => setPlaying(false)}
          onStepBack={() => {
            setPlaying(false);
            setStopIndex((i) => Math.max(0, i - 1));
          }}
          onStepForward={() => {
            setPlaying(false);
            setStopIndex((i) => Math.min(timeline.length - 1, i + 1));
          }}
        />

        {visitOnlyMode && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
            Duty tracking was not active — playback follows visit check-ins in order.
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
            Route stops
          </div>
          <ul className="space-y-1">
            {timeline.map((stop, index) => (
              <li key={stop.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setStopIndex(index);
                  }}
                  className={cn(
                    'w-full text-left text-xs px-2 py-1.5 rounded-md border transition-colors',
                    index === stopIndex
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : index <= stopIndex
                        ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                  )}>
                  <span className="font-medium">{stopKindLabel(stop.kind)}</span>
                  {' · '}
                  {stop.title}
                  <span className="block text-[10px] opacity-80 mt-0.5">
                    {formatReportDateTime(stop.at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="font-semibold text-slate-700 text-xs flex items-center gap-1.5 pt-2">
            <MapPin className="w-3.5 h-3.5" />
            All visits ({journey.visits.length})
          </div>
          <ul className="space-y-1">
            {journey.visits.map((v) => {
              const reached =
                v.check_in_lat != null &&
                visitReachedIndex(timeline, stopIndex, v.id) >= 0;
              return (
                <li key={v.id}>
                  <div
                    className={cn(
                      'text-xs px-2 py-1.5 rounded-md border',
                      reached
                        ? 'bg-teal-50 border-teal-100 text-teal-900'
                        : 'bg-white border-slate-200 text-slate-500'
                    )}>
                    <span className="font-medium">{v.time}</span> · {v.agent_name}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
