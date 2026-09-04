import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import type { KycDocument } from '../lib/api';
import { downloadAuthenticated, viewAuthenticated } from '../lib/download';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export type GalleryDoc = {
  id: number;
  title: string;
  fileName: string;
  mimeType?: string | null;
  /** Public/static preview path when available (e.g. /uploads/kyc/…). */
  url?: string | null;
  agentId: string;
};

const blobCache = new Map<string, { url: string; mimeType: string }>();

function cacheKey(agentId: string, docId: number) {
  return `${agentId}:${docId}`;
}

export function toGalleryDocs(
  agentId: string,
  docs: KycDocument[]
): GalleryDoc[] {
  return docs.map((d) => ({
    id: d.id,
    title: d.docLabel || d.docType,
    fileName: d.fileName,
    mimeType: d.mimeType,
    url: d.url,
    agentId
  }));
}

export function isImageDoc(mimeType?: string | null, fileName?: string) {
  if (mimeType?.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(fileName || '');
}

export function isPdfDoc(mimeType?: string | null, fileName?: string) {
  if (mimeType === 'application/pdf') return true;
  return /\.pdf$/i.test(fileName || '');
}

/** Static upload path — works in <img> without Authorization header. */
export function staticPreviewSrc(doc: { url?: string | null }): string | null {
  if (doc.url?.startsWith('/uploads/')) return doc.url;
  if (doc.url?.startsWith('http')) return doc.url;
  return null;
}

async function resolvePreview(
  doc: GalleryDoc
): Promise<{ url: string; mimeType: string }> {
  const staticUrl = staticPreviewSrc(doc);
  if (staticUrl) {
    return {
      url: staticUrl,
      mimeType: doc.mimeType || 'application/octet-stream'
    };
  }
  const key = cacheKey(doc.agentId, doc.id);
  const cached = blobCache.get(key);
  if (cached) return cached;
  const result = await viewAuthenticated(
    `/agents/${doc.agentId}/kyc-docs/${doc.id}/view`
  );
  blobCache.set(key, result);
  return result;
}

interface KycDocThumbProps {
  doc: GalleryDoc;
  className?: string;
  onOpen?: () => void;
}

export function KycDocThumb({ doc, className, onOpen }: KycDocThumbProps) {
  const [src, setSrc] = useState<string | null>(staticPreviewSrc(doc));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const staticUrl = staticPreviewSrc(doc);
    if (staticUrl) {
      setSrc(staticUrl);
      return;
    }
    if (!isImageDoc(doc.mimeType, doc.fileName)) return;
    let cancelled = false;
    resolvePreview(doc)
      .then((r) => {
        if (!cancelled) setSrc(r.url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const image = isImageDoc(doc.mimeType, doc.fileName) && !!src && !failed;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left transition-colors hover:border-apsBlue/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-apsBlue/40',
        className
      )}>
      {image ? (
        <img
          src={src!}
          alt={doc.title}
          loading="lazy"
          decoding="async"
          className="w-full aspect-[4/3] object-cover transition-transform group-hover:scale-[1.02]"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-1.5 text-slate-500 bg-slate-50">
          <FileText className="w-8 h-8 text-slate-300" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            {isPdfDoc(doc.mimeType, doc.fileName) ? 'PDF' : 'File'}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-2">
        <div className="text-[11px] font-semibold text-white truncate">{doc.title}</div>
        <div className="text-[10px] text-white/70 truncate">{doc.fileName}</div>
      </div>
    </button>
  );
}

interface KycDocGalleryProps {
  docs: GalleryDoc[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function KycDocGallery({
  docs,
  index,
  onClose,
  onIndexChange
}: KycDocGalleryProps) {
  const doc = docs[index];
  const [zoom, setZoom] = useState(1);
  const [preview, setPreview] = useState<{ url: string; mimeType: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setZoom(1);
    setLoading(true);
    setFailed(false);
    setPreview(null);
    resolvePreview(doc)
      .then((r) => {
        if (!cancelled) {
          setPreview(r);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    if (!docs.length) return;
    const neighbors = [docs[index - 1], docs[index + 1]].filter(Boolean);
    for (const n of neighbors) {
      void resolvePreview(n).then((r) => {
        if (isImageDoc(n.mimeType, n.fileName) || staticPreviewSrc(n)) {
          const img = new Image();
          img.src = r.url;
        }
      });
    }
  }, [docs, index]);

  const go = useCallback(
    (delta: number) => {
      if (!docs.length) return;
      const next = (index + delta + docs.length) % docs.length;
      onIndexChange(next);
    },
    [docs.length, index, onIndexChange]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  if (!doc) return null;

  const mime = preview?.mimeType || doc.mimeType;
  const image = isImageDoc(mime, doc.fileName) && !failed && !!preview;
  const pdf = isPdfDoc(mime, doc.fileName) && !!preview;

  const handleDownload = async () => {
    try {
      await downloadAuthenticated(
        `/agents/${doc.agentId}/kyc-docs/${doc.id}/download`,
        doc.fileName
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/80 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${doc.title}`}>
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 bg-black/40 text-white shrink-0"
        onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{doc.title}</div>
          <div className="text-[11px] text-white/60 truncate">
            {doc.fileName}
            {docs.length > 1 ? ` · ${index + 1} of ${docs.length}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {image && (
            <>
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() =>
                  setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))
                }
                className="p-2 rounded-lg hover:bg-white/10">
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() =>
                  setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))
                }
                className="p-2 rounded-lg hover:bg-white/10">
                <ZoomIn className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white/10">
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 relative flex items-center justify-center min-h-0 p-4"
        onClick={(e) => e.stopPropagation()}>
        {docs.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous document"
              onClick={() => go(-1)}
              className="absolute left-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Next document"
              onClick={() => go(1)}
              className="absolute right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70">
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {loading ? (
          <Loader2 className="w-8 h-8 text-white/70 animate-spin" />
        ) : image && preview ? (
          <div className="relative max-w-full max-h-full overflow-auto">
            <img
              src={preview.url}
              alt={doc.title}
              className="max-w-[92vw] max-h-[72vh] object-contain rounded-lg shadow-2xl transition-transform origin-center"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        ) : pdf && preview ? (
          <iframe
            src={preview.url}
            title={doc.title}
            className="w-full max-w-4xl h-[75vh] rounded-lg border border-white/10 bg-white"
          />
        ) : (
          <div className="text-center text-white/80 py-16 px-6">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Preview not available</p>
            <p className="text-xs mt-1 opacity-70">Use Download to open this file</p>
          </div>
        )}
      </div>

      {docs.length > 1 && (
        <div
          className="shrink-0 px-4 py-3 bg-black/50 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2 justify-center min-w-min mx-auto">
            {docs.map((d, i) => {
              const thumbSrc = staticPreviewSrc(d);
              const thumbImage = isImageDoc(d.mimeType, d.fileName) && !!thumbSrc;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  className={cn(
                    'shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors',
                    i === index
                      ? 'border-apsBlue'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  )}>
                  {thumbImage ? (
                    <img
                      src={thumbSrc}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white/60" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
