import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadAuthenticated } from '../lib/download';

interface ExportButtonProps {
  path: string;
  filename: string;
  label?: string;
  className?: string;
}

export function ExportButton({
  path,
  filename,
  label = 'Export CSV',
  className = ''
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      await downloadAuthenticated(path, filename);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className={
        className ||
        'flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 transition-colors disabled:opacity-60'
      }>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4 text-slate-400" />
      )}
      {label}
    </button>
  );
}
