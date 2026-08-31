import L from 'leaflet';
import type { JourneyTimelineStop } from './journey-timeline';

const baseHtml = (content: string) =>
  `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%">${content}</div>`;

export function journeyStartIcon() {
  return L.divIcon({
    className: 'journey-map-icon',
    html: baseHtml(
      `<span style="width:28px;height:28px;border-radius:9999px;background:#22C55E;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff">S</span>`
    ),
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

export function journeyEndIcon() {
  return L.divIcon({
    className: 'journey-map-icon',
    html: baseHtml(
      `<span style="width:28px;height:28px;border-radius:9999px;background:#EF4444;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff">E</span>`
    ),
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

export function journeyVisitIcon(order: number, active: boolean, reached: boolean) {
  const bg = !reached ? '#94A3B8' : active ? '#0D9488' : '#00897B';
  const scale = active ? 1.15 : 1;
  return L.divIcon({
    className: 'journey-map-icon',
    html: baseHtml(
      `<span style="width:26px;height:26px;border-radius:9999px;background:${bg};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;transform:scale(${scale})">${order}</span>`
    ),
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}

export function journeyHeadIcon() {
  return L.divIcon({
    className: 'journey-map-icon journey-head-icon',
    html: baseHtml(
      `<span style="width:18px;height:18px;border-radius:9999px;background:#1565C0;border:3px solid #fff;box-shadow:0 0 0 4px rgba(21,101,192,.35)"></span>`
    ),
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

export function isStartStop(stop: JourneyTimelineStop) {
  return stop.kind === 'duty_start' || stop.kind === 'route_start';
}

export function isEndStop(stop: JourneyTimelineStop) {
  return stop.kind === 'duty_end' || stop.kind === 'route_end';
}
