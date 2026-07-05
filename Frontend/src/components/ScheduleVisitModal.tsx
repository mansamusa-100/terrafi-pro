import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { ApiError } from '../lib/api';

const VISIT_TYPES = [
  'Float check',
  'Branding audit',
  'KYC renewal',
  'Equipment check',
  'Issue follow-up'
];

interface ScheduleVisitModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<unknown>;
  presetAgentId?: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ScheduleVisitModal({
  open,
  onClose,
  onSubmit,
  presetAgentId
}: ScheduleVisitModalProps) {
  const { user } = useAuth();
  const { agents, users } = useAppData();
  const isManager = user ? can(user.role, 'editAgent') : false;
  const adrs = users.filter((u) => u.role === 'adr' && u.id);

  const [agentId, setAgentId] = useState(presetAgentId || '');
  const [visitType, setVisitType] = useState(VISIT_TYPES[0]);
  const [visitDate, setVisitDate] = useState(todayISO());
  const [time, setTime] = useState('09:00');
  const [officerId, setOfficerId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const agentOptions = useMemo(() => {
    if (!user || user.role !== 'adr') return agents;
    return agents.filter(
      (a) => a.officer_id === user.id || a.officer === user.name
    );
  }, [agents, user]);

  useEffect(() => {
    if (open) {
      setAgentId(presetAgentId || '');
      setVisitDate(todayISO());
      setTime('09:00');
      setNotes('');
      setOfficerId('');
    }
  }, [open, presetAgentId]);

  useEffect(() => {
    if (!agentId) return;
    const agent = agents.find((a) => a.id === agentId);
    if (agent?.officer_id && !officerId) {
      setOfficerId(agent.officer_id);
    }
  }, [agentId, agents, officerId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId) {
      toast.error('Select an agent');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        agentId,
        type: visitType,
        visitDate,
        time,
        notes: notes.trim() || undefined,
        ...(isManager && officerId ? { officer_id: officerId } : {})
      });
      toast.success('Visit scheduled');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Scheduling failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 outline-none focus:border-apsBlue focus:ring-1 focus:ring-apsBlue/20';

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-50" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-apsBlue" />
              <h2 className="text-base font-semibold text-slate-900">
                Schedule visit
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                Agent
              </label>
              <select
                required
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                aria-label="Agent"
                className={inputClass}>
                <option value="">Select agent…</option>
                {agentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.zone}
                  </option>
                ))}
              </select>
            </div>

            {isManager && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Assign to ADR
                </label>
                <select
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  aria-label="ADR"
                  className={inputClass}>
                  <option value="">Use agent&apos;s ADR</option>
                  {adrs.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.zone || 'No zone'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                Visit type
              </label>
              <select
                value={visitType}
                onChange={(e) => setVisitType(e.target.value)}
                aria-label="Visit type"
                className={inputClass}>
                {VISIT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Date
                </label>
                <input
                  type="date"
                  required
                  min={todayISO()}
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  aria-label="Visit date"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Time
                </label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  aria-label="Visit time"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                Notes (optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Follow up on low float from last week"
                className={inputClass}
              />
            </div>
          </div>

          <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-lg bg-apsBlue text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Schedule
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
