import React from 'react';
import { ArrowLeft, History } from 'lucide-react';
import { FloatIntegrationCard } from '../components/FloatIntegrationCard';

interface PartnerIntegrationPageProps {
  setPage: (page: string) => void;
}

export function PartnerIntegrationPage({ setPage }: PartnerIntegrationPageProps) {
  return (
    <div className="page-pad max-w-4xl">
      <button
        type="button"
        onClick={() => setPage('settings')}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </button>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Partner integration</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure PrixBI agent float sync credentials and monitor incoming deliveries.
        </p>
      </div>

      <FloatIntegrationCard />

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Float sync log</h3>
            <p className="text-xs text-slate-500 mt-1">
              Review delivery history, record counts, and which agents were updated after
              each PrixBI snapshot.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPage('float-sync')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 shrink-0">
            <History className="w-4 h-4" />
            Open float sync log
          </button>
        </div>
      </div>
    </div>
  );
}
