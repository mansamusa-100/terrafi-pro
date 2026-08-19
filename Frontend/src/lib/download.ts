import { getToken } from './api';

export async function downloadAuthenticated(
  apiPath: string,
  filename: string
) {
  const token = getToken();
  const res = await fetch(`/api${apiPath}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Download failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Fetch a file as an object URL for in-app viewing.
 * Caller is responsible for revoking via URL.revokeObjectURL().
 */
export async function viewAuthenticated(
  apiPath: string
): Promise<{ url: string; mimeType: string }> {
  const token = getToken();
  const res = await fetch(`/api${apiPath}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not load document');
  }
  const mimeType = res.headers.get('Content-Type') || 'application/octet-stream';
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), mimeType };
}
