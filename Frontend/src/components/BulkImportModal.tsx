import React, { useRef, useState } from 'react';
import { X, Download, Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import { useAppData } from '../lib/data-context';

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function BulkImportModal({ open, onClose }: BulkImportModalProps) {
  const { importAgents } = useAppData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  if (!open) return null;

  const downloadTemplate = async () => {
    try {
      const csv = await api.agents.importTemplate();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'agent-import-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const csv = await file.text();
      const res = await importAgents(csv);
      setResult({ created: res.created, errors: res.errors });
      if (res.created > 0) {
        toast.success(`Imported ${res.created} agent(s)`);
      }
      if (res.errors.length > 0) {
        toast.warning(`${res.errors.length} row(s) failed`);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Import failed');
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
              Bulk import agents
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a CSV — KYC documents can be added separately
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <button
            onClick={downloadTemplate}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Download className="w-4 h-4" />
            Download CSV template
          </button>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-apsBlue hover:bg-apsBlueLt/20 transition-colors">
            {loading ? (
              <Loader2 className="w-8 h-8 mx-auto text-apsBlue animate-spin" />
            ) : (
              <>
                <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  Click to upload CSV
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Columns: name, phone, zone, national_id, business_type,
                  officer, lat, lng
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </div>

          {result && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm">
              <p className="font-medium text-slate-900">
                {result.created} agent(s) created
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-apsRed max-h-32 overflow-y-auto">
                  {result.errors.map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.error}
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
