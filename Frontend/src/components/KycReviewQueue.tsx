import React, { useCallback, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Download,
  Eye,
  Loader2,
  FileText,
  X
} from 'lucide-react';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { downloadAuthenticated, viewAuthenticated } from '../lib/download';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { ApiError } from '../lib/api';
import type { KycReviewItem } from '../lib/api';
import { Pagination } from './Pagination';
import { PAGE_SIZE, useClientPagination } from '../lib/useClientPagination';

interface KycReviewQueueProps {
  onOpenAgent?: (agentId: string) => void;
}

interface DocViewer {
  url: string;
  mimeType: string;
  title: string;
}

export function KycReviewQueue({ onOpenAgent }: KycReviewQueueProps) {
  const { user } = useAuth();
  const { kycReviewQueue, reviewKyc } = useAppData();
  const canReview = user ? can(user.role, 'reviewKyc') : false;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<KycReviewItem | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [viewing, setViewing] = useState<DocViewer | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const closeViewer = useCallback(() => {
    if (viewing) URL.revokeObjectURL(viewing.url);
    setViewing(null);
  }, [viewing]);

  const viewDoc = async (
    agentId: string,
    docId: number,
    docLabel: string
  ) => {
    setViewLoading(true);
    try {
      const result = await viewAuthenticated(
        `/agents/${agentId}/kyc-docs/${docId}/view`
      );
      setViewing({ ...result, title: docLabel });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open document');
    } finally {
      setViewLoading(false);
    }
  };

  const {
    pageItems: pageQueue,
    total: queueTotal,
    limit: queueLimit,
    offset: queueOffset,
    setOffset: setQueueOffset
  } = useClientPagination(kycReviewQueue, PAGE_SIZE.compact);

  const handleApprove = async (item: KycReviewItem) => {
    setBusyId(item.id);
    try {
      await reviewKyc(item.id, 'approve');
      toast.success(`${item.name} KYC approved`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Approval failed');
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await reviewKyc(rejecting.id, 'reject', rejectNote.trim());
      toast.success(`${rejecting.name} KYC rejected`);
      setRejecting(null);
      setRejectNote('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Rejection failed');
    } finally {
      setBusyId(null);
    }
  };

  const downloadDoc = async (item: KycReviewItem, docId: number, fileName: string) => {
    try {
      await downloadAuthenticated(
        `/agents/${item.id}/kyc-docs/${docId}/download`,
        fileName
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    }
  };

  if (kycReviewQueue.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-slate-500">
        No agents awaiting KYC review.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {pageQueue.map((item) => (
          <div
            key={item.id}
            className="border border-slate-200 rounded-xl p-4 hover:border-apsBlue/30 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenAgent?.(item.id)}
                  className="text-sm font-semibold text-slate-900 hover:text-apsBlue text-left">
                  {item.name}
                </button>
                <div className="text-xs text-slate-500 mt-0.5">
                  {item.id} · {item.zone} · ADR: {item.officer}
                </div>
                {item.submitted_at && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    Submitted{' '}
                    {new Date(item.submitted_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </div>
                )}
              </div>
              {canReview && (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => handleApprove(item)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-apsGreen text-white text-xs font-semibold hover:bg-apsGreen/90 disabled:opacity-60">
                    {busyId === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => {
                      setRejecting(item);
                      setRejectNote('');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-apsRed/30 text-apsRed text-xs font-semibold hover:bg-apsRedLt/40 disabled:opacity-60">
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {item.kyc_docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 min-w-0">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-800 truncate">
                        {doc.docLabel || doc.docType}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {doc.fileName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1.5 border-t border-slate-200 bg-white">
                    <button
                      type="button"
                      title="View document"
                      disabled={viewLoading}
                      onClick={() =>
                        viewDoc(item.id, doc.id, doc.docLabel || doc.docType)
                      }
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-apsBlue hover:bg-apsBlueLt/40">
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                    <button
                      type="button"
                      title="Download document"
                      onClick={() => downloadDoc(item, doc.id, doc.fileName)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-600 hover:bg-slate-100">
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Pagination
        total={queueTotal}
        limit={queueLimit}
        offset={queueOffset}
        onPageChange={setQueueOffset}
      />

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitReject}
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">
              Reject KYC — {rejecting.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              The agent status will be set to expired. ADR can re-upload documents
              to resubmit.
            </p>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              Reason (required)
            </label>
            <textarea
              required
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. National ID image is blurry; business permit expired"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busyId === rejecting.id}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-semibold text-white',
                  'bg-apsRed hover:bg-apsRed/90 disabled:opacity-60'
                )}>
                {busyId === rejecting.id ? 'Rejecting…' : 'Confirm rejection'}
              </button>
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeViewer}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {viewing.title}
              </h3>
              <button
                type="button"
                onClick={closeViewer}
                className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50">
              {viewing.mimeType.startsWith('image/') ? (
                <img
                  src={viewing.url}
                  alt={viewing.title}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg shadow"
                />
              ) : viewing.mimeType === 'application/pdf' ? (
                <iframe
                  src={viewing.url}
                  title={viewing.title}
                  className="w-full h-[75vh] rounded-lg border border-slate-200"
                />
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-600 font-medium">
                    Preview not available for this file type
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Use the Download button to view this document
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
