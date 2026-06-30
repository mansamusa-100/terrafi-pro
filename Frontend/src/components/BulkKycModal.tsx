import React, { useRef, useState } from 'react';
import { X, Upload, Loader2, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '../lib/api';
import { useAppData } from '../lib/data-context';

interface BulkKycModalProps {
  open: boolean;
  onClose: () => void;
}

export function BulkKycModal({ open, onClose }: BulkKycModalProps) {
  const { bulkUploadKyc } = useAppData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<{
    uploaded: number;
    errors: { file: string; error: string }[];
  } | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!files.length) {
      toast.error('Select at least one file');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await bulkUploadKyc(files);
      setResult({ uploaded: res.uploaded, errors: res.errors });
      if (res.uploaded > 0) toast.success(`Uploaded ${res.uploaded} document(s)`);
      if (res.errors.length > 0) toast.warning(`${res.errors.length} file(s) failed`);
      if (res.uploaded > 0 && res.errors.length === 0) {
        setFiles([]);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Bulk upload KYC documents
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Name files:{' '}
              <code className="bg-slate-100 px-1 rounded">
                APW-0001-nationalId.pdf
              </code>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-apsBlueLt/40 border border-apsBlue/20 px-3 py-2.5 text-xs text-slate-700">
            <p className="font-semibold text-apsBlue mb-1">Filename format</p>
            <p>
              <code>{'{agentId}-{docType}.ext'}</code> — docType is{' '}
              <code>nationalId</code>, <code>businessPermit</code>, or{' '}
              <code>agentAgreement</code>
            </p>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-apsBlue hover:bg-apsBlueLt/20 transition-colors">
            <FileUp className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-700">
              Select multiple files
            </p>
            <p className="text-xs text-slate-500 mt-1">PDF, JPEG, PNG, WebP</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => {
                setFiles(Array.from(e.target.files || []));
                setResult(null);
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="text-xs text-slate-600 space-y-1 max-h-32 overflow-y-auto border border-slate-100 rounded-lg p-3">
              {files.map((f) => (
                <li key={f.name} className="truncate">
                  {f.name}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || files.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navyMid disabled:opacity-60">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload {files.length > 0 ? `${files.length} file(s)` : ''}
          </button>

          {result && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm">
              <p className="font-medium text-slate-900">
                {result.uploaded} document(s) uploaded
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-apsRed max-h-32 overflow-y-auto">
                  {result.errors.map((e) => (
                    <li key={e.file}>
                      {e.file}: {e.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
