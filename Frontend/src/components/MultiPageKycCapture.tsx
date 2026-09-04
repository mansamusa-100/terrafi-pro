import React, { useEffect, useMemo } from 'react';
import { Camera, Check, FileText, Trash2, Upload } from 'lucide-react';
import { cn } from '../lib/utils';

interface MultiPageKycCaptureProps {
  label: string;
  pages: File[];
  onChange: (pages: File[]) => void;
  required?: boolean;
  className?: string;
  /** Flush draft before opening camera (Android may kill the page). */
  onBeforeCapture?: () => void;
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function MultiPageKycCapture({
  label,
  pages,
  onChange,
  required,
  className,
  onBeforeCapture
}: MultiPageKycCaptureProps) {
  const previews = useMemo(
    () =>
      pages.map((file) =>
        isPdf(file) ? null : URL.createObjectURL(file)
      ),
    [pages]
  );

  useEffect(
    () => () => {
      previews.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    },
    [previews]
  );

  const addImagePage = (file: File | null) => {
    if (!file) return;
    onChange([...pages, file]);
  };

  const addPdf = (file: File | null) => {
    if (!file) return;
    onChange([file]);
  };

  const removePage = (index: number) => {
    onChange(pages.filter((_, i) => i !== index));
  };

  const complete = pages.length > 0;

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-dashed p-4 transition-colors',
        complete
          ? 'border-apsGreen bg-apsGreenLt/30'
          : 'border-slate-200 bg-white',
        className
      )}>
      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            complete ? 'bg-apsGreen text-white' : 'bg-slate-100 text-slate-400'
          )}>
          {complete ? <Check className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-900">
            {label}
            {required && (
              <span className="text-[10px] font-semibold text-apsRed uppercase tracking-wider ml-2">
                Required
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Prefer Gallery/Files on Samsung and other Android phones — Camera can
            briefly close the app; progress is saved automatically. Or snap pages
            with Camera / upload a PDF.
          </p>
        </div>
      </div>

      {pages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {pages.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="relative rounded-lg border border-slate-200 bg-white overflow-hidden">
              {previews[index] ? (
                <img
                  src={previews[index]!}
                  alt={`${label} page ${index + 1}`}
                  className="w-full aspect-[3/4] object-cover"
                />
              ) : (
                <div className="w-full aspect-[3/4] flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-500 p-2">
                  <FileText className="w-8 h-8" />
                  <span className="text-[10px] font-medium text-center truncate w-full px-1">
                    {file.name}
                  </span>
                </div>
              )}
              <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                {isPdf(file) ? 'PDF' : `Page ${index + 1}`}
              </div>
              <button
                type="button"
                aria-label={`Remove page ${index + 1}`}
                onClick={() => removePage(index)}
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white hover:bg-black/70">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50 transition-colors">
          <Upload className="w-4 h-4" />
          {pages.length === 0 ? 'Gallery / Files' : 'Add from gallery'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onClick={() => onBeforeCapture?.()}
            onChange={(e) => {
              addImagePage(e.target.files?.[0] || null);
              e.target.value = '';
            }}
          />
        </label>
        <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-apsBlue text-white text-xs font-semibold cursor-pointer hover:bg-apsBlueMid transition-colors">
          <Camera className="w-4 h-4" />
          {pages.length === 0 ? 'Camera' : 'Camera page'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onClick={() => onBeforeCapture?.()}
            onChange={(e) => {
              addImagePage(e.target.files?.[0] || null);
              e.target.value = '';
            }}
          />
        </label>
        <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50 transition-colors">
          <FileText className="w-4 h-4" />
          Upload PDF
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onClick={() => onBeforeCapture?.()}
            onChange={(e) => {
              addPdf(e.target.files?.[0] || null);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {pages.length > 0 && (
        <p className="text-[11px] text-slate-500 mt-2">
          {isPdf(pages[0])
            ? '1 PDF document attached'
            : `${pages.length} page${pages.length === 1 ? '' : 's'} captured`}
        </p>
      )}
    </div>
  );
}
