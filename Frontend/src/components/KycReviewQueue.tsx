import React, { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Eye } from 'lucide-react';
import { useAppData } from '../lib/data-context';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { ApiError } from '../lib/api';
import type { KycReviewItem } from '../lib/api';
import { Pagination } from './Pagination';
import { PAGE_SIZE, useClientPagination } from '../lib/useClientPagination';
import {
  KycDocGallery,
  KycDocThumb,
  toGalleryDocs,
  type GalleryDoc
} from './KycDocGallery';

interface KycReviewQueueProps {
  onOpenAgent?: (agentId: string) => void;
}

export function KycReviewQueue({ onOpenAgent }: KycReviewQueueProps) {
  const { user } = useAuth();
  const { kycReviewQueue, reviewKyc } = useAppData();
  const canReview = user ? can(user, 'reviewKyc') : false;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<KycReviewItem | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [galleryDocs, setGalleryDocs] = useState<GalleryDoc[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const {
    pageItems: pageQueue,
    total: queueTotal,
    limit: queueLimit,
    offset: queueOffset,
    setOffset: setQueueOffset
  } = useClientPagination(kycReviewQueue, PAGE_SIZE.compact);

  const openGallery = (item: KycReviewItem, docId: number) => {
    const docs = toGalleryDocs(item.id, item.kyc_docs);
    const idx = Math.max(
      0,
      docs.findIndex((d) => d.id === docId)
    );
    setGalleryDocs(docs);
    setGalleryIndex(idx);
  };

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

            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] text-slate-500">
                Tap a document to review · use arrows for next/previous
              </p>
              <button
                type="button"
                onClick={() => openGallery(item, item.kyc_docs[0]?.id)}
                disabled={!item.kyc_docs.length}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-apsBlue hover:underline disabled:opacity-40">
                <Eye className="w-3.5 h-3.5" />
                Review all
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {item.kyc_docs.map((doc) => (
                <KycDocThumb
                  key={doc.id}
                  doc={{
                    id: doc.id,
                    title: doc.docLabel || doc.docType,
                    fileName: doc.fileName,
                    mimeType: doc.mimeType,
                    url: doc.url,
                    agentId: item.id
                  }}
                  onOpen={() => openGallery(item, doc.id)}
                />
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

      {galleryDocs && (
        <KycDocGallery
          docs={galleryDocs}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryDocs(null)}
        />
      )}
    </>
  );
}
