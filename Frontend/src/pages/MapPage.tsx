import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { Layers, Activity, Droplets } from 'lucide-react';
import { STATUS_META, fmt } from '../lib/data';
import { useAppData } from '../lib/data-context';
import type { Agent } from '../lib/api';
import { cn } from '../lib/utils';
interface MapPageProps {
  setSelectedAgent: (agent: Agent) => void;
}
type Mode = 'status' | 'liquidity';
const STATUS_HEX: Record<string, string> = {
  active: '#22C55E',
  low_float: '#F59E0B',
  critical: '#EF4444',
  suspended: '#64748B'
};
function floatHex(efloat: number) {
  if (efloat < 5000) return '#EF4444';
  if (efloat < 20000) return '#F59E0B';
  if (efloat < 50000) return '#1565C0';
  return '#00897B';
}
export function MapPage({ setSelectedAgent }: MapPageProps) {
  const { agents, zones } = useAppData();
  const [mode, setMode] = useState<Mode>('status');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const filtered = useMemo(
    () =>
    agents.filter(
      (a) =>
      (zoneFilter === 'all' || a.zone === zoneFilter) && (
      statusFilter === 'all' || a.status === statusFilter)
    ),
    [zoneFilter, statusFilter, agents]
  );
  const colorFor = (a: any) =>
  mode === 'status' ? STATUS_HEX[a.status] : floatHex(a.efloat);
  const radiusFor = (a: any) =>
  mode === 'liquidity' ?
  Math.max(7, Math.min(22, Math.sqrt(a.efloat) / 18)) :
  9;
  const legend =
  mode === 'status' ?
  [
  ['Active', '#22C55E'],
  ['Low float', '#F59E0B'],
  ['Critical', '#EF4444'],
  ['Suspended', '#64748B']] :

  [
  ['≥ D 50K', '#00897B'],
  ['D 20K–50K', '#1565C0'],
  ['D 5K–20K', '#F59E0B'],
  ['< D 5K', '#EF4444']];

  const selectClass =
  'px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-apsBlue transition-colors';
  return (
    <div className="page-pad h-full flex flex-col min-h-[min(70dvh,640px)]">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setMode('status')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              mode === 'status' ?
              'bg-white text-slate-900 shadow-sm' :
              'text-slate-600 hover:text-slate-900'
            )}>
            
            <Activity className="w-3.5 h-3.5" />
            Agent status
          </button>
          <button
            onClick={() => setMode('liquidity')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              mode === 'liquidity' ?
              'bg-white text-slate-900 shadow-sm' :
              'text-slate-600 hover:text-slate-900'
            )}>
            
            <Droplets className="w-3.5 h-3.5" />
            Liquidity heatmap
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select
            className={selectClass}
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}>
            
            <option value="all">All zones</option>
            {zones.map((z) =>
            <option key={z} value={z}>
                {z}
              </option>
            )}
          </select>
          <select
            className={selectClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}>
            
            <option value="all">All statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) =>
            <option key={k} value={k}>
                {v.label}
              </option>
            )}
          </select>
        </div>
      </div>

      {/* Map + side list */}
      <div className="flex-1 grid grid-cols-[1fr_300px] gap-4 min-h-0">
        <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <MapContainer
            center={[13.45, -16.35]}
            zoom={9}
            scrollWheelZoom
            className="h-full w-full">
            
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            
            {filtered.map((a) =>
            <CircleMarker
              key={a.id}
              center={[a.lat, a.lng]}
              radius={radiusFor(a)}
              pathOptions={{
                color: colorFor(a),
                fillColor: colorFor(a),
                fillOpacity: 0.55,
                weight: 2
              }}
              eventHandlers={{
                click: () => setSelectedAgent(a)
              }}>
              
                <Tooltip direction="top" offset={[0, -4]}>
                  <div className="text-xs">
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-slate-500">
                      {a.zone} · {fmt(a.efloat)}
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            )}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur rounded-lg border border-slate-200 shadow-sm px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <Layers className="w-3 h-3" />
              {mode === 'status' ? 'Status' : 'E-float level'}
            </div>
            <div className="space-y-1">
              {legend.map(([label, color]) =>
              <div key={label} className="flex items-center gap-2">
                  <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: color
                  }} />
                
                  <span className="text-xs text-slate-700">{label}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side list */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-slate-100 shrink-0">
            <div className="text-sm font-semibold text-slate-900">
              {filtered.length} agents shown
            </div>
            <div className="text-[11px] text-slate-500">
              Click a marker or row to view details
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map((a) =>
            <button
              key={a.id}
              onClick={() => setSelectedAgent(a)}
              className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors text-left">
              
                <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  background: colorFor(a)
                }} />
              
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-900 truncate">
                    {a.name}
                  </div>
                  <div className="text-[10px] text-slate-500">{a.zone}</div>
                </div>
                <div className="text-[11px] font-semibold text-slate-700">
                  {fmt(a.efloat)}
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>);

}