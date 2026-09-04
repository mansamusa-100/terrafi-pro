/** Shrink phone-camera images before upload (KYC / location photos). */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.72;
const MIN_BYTES_TO_COMPRESS = 350_000;

function isCompressibleImage(file: File): boolean {
  if (!file.type.startsWith('image/')) return false;
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return false;
  // HEIC/HEIF often can't be drawn to canvas in mobile browsers
  if (/heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) return false;
  return file.size >= MIN_BYTES_TO_COMPRESS;
}

function loadImageBitmap(file: File): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => loadViaImageElement(file));
  }
  return loadViaImageElement(file);
}

function loadViaImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image'));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Returns a smaller JPEG/WebP File when the source is a large photo.
 * PDFs and small images are returned unchanged.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!isCompressibleImage(file)) return file;

  try {
    const source = await loadImageBitmap(file);
    const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
    const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(source as CanvasImageSource, 0, 0, targetW, targetH);

    if ('close' in source && typeof source.close === 'function') {
      source.close();
    }

    const outType = 'image/jpeg';
    const blob = await canvasToBlob(canvas, outType, JPEG_QUALITY);
    if (!blob || blob.size >= file.size * 0.95) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.jpg`, {
      type: outType,
      lastModified: Date.now()
    });
  } catch {
    return file;
  }
}

export async function compressImagesForUpload(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImageForUpload));
}
