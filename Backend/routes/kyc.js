import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { companyFilter, serializeAgent } from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';
import {
  notifyKycApproved,
  notifyKycRejected
} from '../lib/notifications.js';
import {
  agentHasAllKycDocs,
  buildKycStats
} from '../lib/kyc-status.js';
import { KYC_DOC_LABELS } from '../lib/kyc.js';

const router = Router();

function formatQueueAgent(agent) {
  const latestUpload = agent.kycDocs.reduce(
    (max, d) => (d.uploadedAt > max ? d.uploadedAt : max),
    agent.kycDocs[0]?.uploadedAt ?? null
  );

  return {
    ...serializeAgent(agent, { kyc_doc_count: agent.kycDocs.length }),
    kyc_review_note: agent.kycReviewNote,
    kyc_reviewed_at: agent.kycReviewedAt,
    submitted_at: latestUpload,
    kyc_docs: agent.kycDocs.map((d) => ({
      id: d.id,
      docType: d.docType,
      docLabel: KYC_DOC_LABELS[d.docType] || d.docType,
      fileName: d.fileName,
      url: `/uploads/${d.filePath}`,
      uploadedAt: d.uploadedAt
    }))
  };
}

router.get('/stats', requireRoles('manager', 'internal'), async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    if (!companyId) return res.status(400).json({ error: 'Company context required' });

    const agents = await prisma.agent.findMany({
      where: { companyId },
      select: { kyc: true, status: true }
    });

    res.json(buildKycStats(agents));
  } catch (err) {
    next(err);
  }
});

router.get('/review-queue', requireRoles('manager', 'internal'), async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user);
    if (!companyId) return res.status(400).json({ error: 'Company context required' });

    const agents = await prisma.agent.findMany({
      where: { companyId, kyc: 'pending' },
      orderBy: { name: 'asc' },
      include: {
        kycDocs: { orderBy: { uploadedAt: 'desc' } }
      }
    });

    const queue = [];
    for (const agent of agents) {
      if (await agentHasAllKycDocs(agent.id)) {
        queue.push(formatQueueAgent(agent));
      }
    }

    queue.sort(
      (a, b) =>
        new Date(b.submitted_at || 0).getTime() -
        new Date(a.submitted_at || 0).getTime()
    );

    res.json(queue);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/review/:agentId',
  requireRoles('manager'),
  async (req, res, next) => {
    try {
      const { action, note } = req.body;
      const companyId = companyFilter(req.user);
      if (!companyId) return res.status(400).json({ error: 'Company context required' });

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'action must be approve or reject' });
      }
      if (action === 'reject' && !note?.trim()) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      const agent = await prisma.agent.findFirst({
        where: { id: req.params.agentId, companyId }
      });
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      if (agent.kyc !== 'pending') {
        return res.status(400).json({ error: 'Agent is not awaiting KYC review' });
      }

      const hasAll = await agentHasAllKycDocs(agent.id);
      if (!hasAll) {
        return res.status(400).json({ error: 'Required KYC documents are incomplete' });
      }

      const now = new Date();
      const updated = await prisma.agent.update({
        where: { id: agent.id },
        data:
          action === 'approve'
            ? {
                kyc: 'verified',
                kycReviewNote: null,
                kycReviewedAt: now,
                kycReviewedById: req.user.id
              }
            : {
                kyc: 'expired',
                kycReviewNote: note.trim(),
                kycReviewedAt: now,
                kycReviewedById: req.user.id
              }
      });

      await logAudit({
        scope: 'company',
        companyId,
        actor: req.user,
        action: action === 'approve' ? 'kyc.approved' : 'kyc.rejected',
        entityType: 'agent',
        entityId: agent.id,
        details: {
          agentName: agent.name,
          ...(action === 'reject' ? { reason: note.trim() } : {})
        }
      });

      if (action === 'approve') {
        await notifyKycApproved(agent, req.user);
      } else {
        await notifyKycRejected(agent, req.user, note.trim());
      }

      res.json({
        ...serializeAgent(updated),
        kyc_review_note: updated.kycReviewNote,
        kyc_reviewed_at: updated.kycReviewedAt
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
