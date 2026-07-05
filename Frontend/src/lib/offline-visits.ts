const STORAGE_KEY = 'field-pro-offline-visits';
const DEVICE_KEY = 'field-pro-device-id';

export interface QueuedVisit {
  id: string;
  queuedAt: string;
  agentId: string;
  agentName: string;
  body: Record<string, unknown>;
  captureDistance?: number | null;
  gpsOkAtCapture?: boolean;
  lastError?: string;
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function readQueue(): QueuedVisit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedVisit[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('offline-visits-changed'));
}

export function getQueuedVisits(): QueuedVisit[] {
  return readQueue();
}

export function getQueuedVisitCount(): number {
  return readQueue().length;
}

export function enqueueVisit(
  body: Record<string, unknown>,
  meta: {
    agentName: string;
    captureDistance?: number | null;
    gpsOkAtCapture?: boolean;
  }
): QueuedVisit {
  const item: QueuedVisit = {
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
    agentId: String(body.agentId),
    agentName: meta.agentName,
    body,
    captureDistance: meta.captureDistance,
    gpsOkAtCapture: meta.gpsOkAtCapture
  };
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
  return item;
}

export function removeQueuedVisit(id: string) {
  writeQueue(readQueue().filter((v) => v.id !== id));
}

export function updateQueuedVisitError(id: string, message: string) {
  const queue = readQueue().map((v) =>
    v.id === id ? { ...v, lastError: message } : v
  );
  writeQueue(queue);
}

export function isBrowserOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('load failed')
    );
  }
  return false;
}
