import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import {
  companyFilter,
  nextAgentId,
  serializeAgent,
  agentWhereForUser,
  isAgentAssignedToUser,
  resolveOfficerAssignment
} from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import { denyInternalWithout, userCanEditAgentProfile } from '../lib/internal-capabilities.js';
import { kycUpload, bulkKycUpload, kycUploadDir, locationPhotoUpload } from '../middleware/upload.js';
import { KYC_DOC_TYPES, KYC_DOC_LABELS, parseKycFilename } from '../lib/kyc.js';
import { syncKycStatus } from '../lib/kyc-status.js';
import { notifyAgentOnboarded } from '../lib/notifications.js';
import { logAgentOnboardedReport } from '../lib/notification-report.js';
import { logAudit } from '../lib/audit.js';
import { parseCsv, AGENT_IMPORT_TEMPLATE } from '../lib/csv.js';
import { normalizePhone } from '../lib/phone.js';

const router = Router();

function resolveAgentPhone(phone) {
  const trimmed = phone?.trim();
  if (!trimmed) {
    return { error: 'Phone is required' };
  }
  const phoneNormalized = normalizePhone(trimmed);
  if (!phoneNormalized) {
    return {
      error:
        'Invalid phone number. Use a 7-digit local number or +220 format.'
    };
  }
  return { phone: trimmed, phoneNormalized };
}

async function assertAgentAccess(req, agent) {
  if (!agent) return { error: 'Agent not found', status: 404 };
  const companyId = companyFilter(req.user);
  if (req.user.role === 'agent' && agent.id !== req.user.scope) {
    return { error: 'Access denied', status: 403 };
  }
  if (companyId && agent.companyId !== companyId) {
    return { error: 'Access denied', status: 403 };
  }
  if (!isAgentAssignedToUser(agent, req.user)) {
    return { error: 'Agent is not assigned to you', status: 403 };
  }
  return null;
}

router.get('/', denyInternalWithout('view_agents', 'edit_agents'), async (req, res, next) => {
  try {
    const where = agentWhereForUser(req.user);

    const agents = await prisma.agent.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { kycDocs: true } } }
    });
    res.json(
      agents.map((a) =>
        serializeAgent(
          a,
          { kyc_doc_count: a._count.kycDocs },
          { includeLocationPhoto: false }
        )
      )
    );
  } catch (err) {
    next(err);
  }
});

router.get('/import/template', requireRoles('manager', 'team_lead', 'adr'), (_req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="agent-import-template.csv"'
  );
  res.send(AGENT_IMPORT_TEMPLATE);
});

router.post('/import', requireRoles('manager', 'team_lead', 'adr'), async (req, res, next) => {
  try {
    const { csv } = req.body;
    if (!csv?.trim()) {
      return res.status(400).json({ error: 'CSV content is required' });
    }

    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const { records } = parseCsv(csv);
    if (records.length === 0) {
      return res.status(400).json({ error: 'No data rows found in CSV' });
    }

    const created = [];
    const errors = [];
    const joined = new Date().toLocaleString('en-US', {
      month: 'short',
      year: 'numeric'
    });

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;
      const name = row.name?.trim();
      const phone = row.phone?.trim();
      const zone = row.zone?.trim();

      if (!name || !phone || !zone) {
        errors.push({
          row: rowNum,
          error: 'name, phone, and zone are required'
        });
        continue;
      }

      const phoneFields = resolveAgentPhone(phone);
      if (phoneFields.error) {
        errors.push({ row: rowNum, error: phoneFields.error });
        continue;
      }

      let assignment;
      if (req.user.role === 'adr') {
        assignment = { officerId: req.user.id, officer: req.user.name };
      } else {
        assignment = await resolveOfficerAssignment(companyId, {
          officerName: row.officer?.trim(),
          fallback: { officerId: null, officer: 'Unassigned' }
        });
      }

      try {
        const id = await nextAgentId(companyId);
        const agent = await prisma.$transaction(async (tx) => {
          const createdAgent = await tx.agent.create({
            data: {
              id,
              companyId,
              name,
              zone,
              phone: phoneFields.phone,
              phoneNormalized: phoneFields.phoneNormalized,
              status: 'active',
              officer: assignment.officer,
              officerId: assignment.officerId,
              joined,
              lat: row.lat ? parseFloat(row.lat) : 13.45,
              lng: row.lng ? parseFloat(row.lng) : -16.65,
              kyc: 'pending',
              lastVisit: 'Never',
              nationalId: row.national_id?.trim() || null,
              businessType: row.business_type?.trim() || null,
              onboardedById: req.user.id
            }
          });
          await tx.company.update({
            where: { id: companyId },
            data: { agents: { increment: 1 } }
          });
          return createdAgent;
        });
        created.push(serializeAgent(agent));
        await logAgentOnboardedReport(agent, req.user);
      } catch (e) {
        const msg = e.code === 'P2002'
          ? 'An agent with this phone number already exists'
          : e.message || 'Failed to create agent';
        errors.push({
          row: rowNum,
          error: msg
        });
      }
    }

    res.status(201).json({
      created: created.length,
      agents: created,
      errors
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/kyc-docs/bulk',
  requireRoles('manager', 'team_lead', 'adr'),
  bulkKycUpload.array('files', 100),
  async (req, res, next) => {
    try {
      const companyId = companyFilter(req.user);
      if (!req.files?.length) {
        return res.status(400).json({ error: 'At least one file is required' });
      }

      const uploaded = [];
      const errors = [];

      for (const file of req.files) {
        const parsed = parseKycFilename(file.originalname);
        if (!parsed) {
          errors.push({
            file: file.originalname,
            error:
              'Invalid filename. Use {agentId}-{docType}.ext (e.g. APW-0001-nationalId.pdf)'
          });
          fs.unlink(file.path, () => {});
          continue;
        }

        if (!KYC_DOC_TYPES.includes(parsed.docType)) {
          errors.push({
            file: file.originalname,
            error: `docType must be one of: ${KYC_DOC_TYPES.join(', ')}`
          });
          fs.unlink(file.path, () => {});
          continue;
        }

        const agent = await prisma.agent.findUnique({
          where: { id: parsed.agentId }
        });
        const access = await assertAgentAccess(req, agent);
        if (access) {
          errors.push({ file: file.originalname, error: access.error });
          fs.unlink(file.path, () => {});
          continue;
        }
        if (companyId && agent.companyId !== companyId) {
          errors.push({ file: file.originalname, error: 'Access denied' });
          fs.unlink(file.path, () => {});
          continue;
        }

        const doc = await prisma.kycDocument.create({
          data: {
            agentId: agent.id,
            docType: parsed.docType,
            fileName: file.originalname,
            filePath: path.posix.join('kyc', file.filename),
            mimeType: file.mimetype
          }
        });

        await syncKycStatus(agent.id);

        uploaded.push({
          agentId: agent.id,
          docType: doc.docType,
          fileName: doc.fileName,
          id: doc.id
        });
      }

      res.status(201).json({ uploaded: uploaded.length, documents: uploaded, errors });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/', requireRoles('manager', 'team_lead', 'adr'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 'co-aps';
    const {
      name,
      phone,
      zone,
      lat,
      lng,
      officer,
      officer_id,
      nationalId,
      businessType,
      businessTypeOther,
      outletName,
      personalPhone,
      townVillage,
      competitorsPresent,
      brandingPresent,
      gender
    } = req.body;

    if (!name?.trim() || !phone?.trim() || !zone) {
      return res
        .status(400)
        .json({ error: 'Name, business phone, and zone are required' });
    }
    if (!outletName?.trim()) {
      return res.status(400).json({ error: 'Outlet / business name is required' });
    }
    if (!townVillage?.trim()) {
      return res.status(400).json({ error: 'Town / village is required' });
    }

    const agentLat = lat != null ? Number(lat) : NaN;
    const agentLng = lng != null ? Number(lng) : NaN;
    if (!Number.isFinite(agentLat) || !Number.isFinite(agentLng)) {
      return res.status(400).json({
        error: 'Agent GPS location is required (lat and lng)'
      });
    }
    if (
      agentLat < -90 ||
      agentLat > 90 ||
      agentLng < -180 ||
      agentLng > 180
    ) {
      return res.status(400).json({ error: 'GPS coordinates are out of range' });
    }

    const phoneFields = resolveAgentPhone(phone);
    if (phoneFields.error) {
      return res.status(400).json({ error: phoneFields.error });
    }

    if (!personalPhone?.trim()) {
      return res.status(400).json({ error: 'Personal contact number is required' });
    }
    const resolvedPersonal = resolveAgentPhone(personalPhone);
    if (resolvedPersonal.error) {
      return res.status(400).json({ error: `Personal phone: ${resolvedPersonal.error}` });
    }
    const personalFields = {
      personalPhone: resolvedPersonal.phone,
      personalPhoneNormalized: resolvedPersonal.phoneNormalized
    };

    let resolvedBusinessType = businessType || null;
    let resolvedBusinessOther = null;
    if (businessType === 'Others') {
      if (!businessTypeOther?.trim()) {
        return res.status(400).json({
          error: 'Please specify the business type when selecting Others'
        });
      }
      resolvedBusinessType = 'Others';
      resolvedBusinessOther = businessTypeOther.trim();
    }

    const competitors = Array.isArray(competitorsPresent)
      ? competitorsPresent.map(String).filter(Boolean)
      : [];
    const branding = Array.isArray(brandingPresent)
      ? brandingPresent.map(String).filter(Boolean)
      : [];

    let assignment;
    if (req.user.role === 'adr') {
      assignment = { officerId: req.user.id, officer: req.user.name };
    } else {
      const allowedAdrIds =
        req.user.role === 'team_lead' ? req.user.supervisedAdrIds : null;
      assignment = await resolveOfficerAssignment(
        companyId,
        {
          officerId: officer_id,
          officerName: officer,
          fallback: { officerId: null, officer: 'Unassigned' }
        },
        { allowedAdrIds }
      );
      if (!assignment) {
        return res.status(400).json({ error: 'Invalid ADR assignment' });
      }
      if (req.user.role === 'team_lead' && !assignment.officerId) {
        return res.status(400).json({
          error: 'Team leads must assign the agent to one of their ADRs'
        });
      }
    }

    const id = await nextAgentId(companyId);
    const joined = new Date().toLocaleString('en-US', {
      month: 'short',
      year: 'numeric'
    });

    const agent = await prisma.$transaction(async (tx) => {
      const created = await tx.agent.create({
        data: {
          id,
          companyId,
          name: name.trim(),
          zone,
          phone: phoneFields.phone,
          phoneNormalized: phoneFields.phoneNormalized,
          status: 'active',
          officer: assignment.officer,
          officerId: assignment.officerId,
          joined,
          lat: agentLat,
          lng: agentLng,
          kyc: 'pending',
          lastVisit: 'Never',
          nationalId: nationalId || null,
          businessType: resolvedBusinessType,
          businessTypeOther: resolvedBusinessOther,
          outletName: outletName.trim(),
          personalPhone: personalFields.personalPhone,
          personalPhoneNormalized: personalFields.personalPhoneNormalized,
          townVillage: townVillage.trim(),
          competitorsPresent: competitors,
          brandingPresent: branding,
          onboardedById: req.user.id,
          gender: gender?.trim() || null
        }
      });
      await tx.company.update({
        where: { id: companyId },
        data: { agents: { increment: 1 } }
      });
      return created;
    });

    await notifyAgentOnboarded(agent, req.user);
    await logAgentOnboardedReport(agent, req.user);

    await logAudit({
      scope: 'company',
      companyId,
      actor: req.user,
      action: 'agent.onboarded',
      entityType: 'agent',
      entityId: agent.id,
      details: { name: agent.name, zone: agent.zone, officer: agent.officer }
    });

    res.status(201).json(serializeAgent(agent));
  } catch (err) {
    if (err.code === 'P2002') {
      return res
        .status(409)
        .json({ error: 'An agent with this phone number already exists' });
    }
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: {
        kycDocs: { orderBy: [{ docType: 'asc' }, { id: 'asc' }] },
        _count: { select: { visitsRel: true } }
      }
    });

    const access = await assertAgentAccess(req, agent);
    if (access) return res.status(access.status).json({ error: access.error });

    const visits = await prisma.visit.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({
      ...serializeAgent(agent, {
        kyc_doc_count: agent.kycDocs.length,
        visit_count: agent._count.visitsRel
      }),
      kyc_docs: agent.kycDocs.map((d) => ({
        id: d.id,
        docType: d.docType,
        docLabel: KYC_DOC_LABELS[d.docType] || d.docType,
        fileName: d.fileName,
        mimeType: d.mimeType,
        url: `/uploads/${d.filePath}`,
        uploadedAt: d.uploadedAt
      })),
      recent_visits: visits.map((v) => ({
        id: v.id,
        officer: v.officer,
        status: v.status,
        time: v.time,
        type: v.type,
        zone: v.zone,
        visit_date: v.visitDate,
        gps_verified: v.gpsVerified,
        notes: v.notes
      }))
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/location-photo',
  requireRoles('manager', 'team_lead', 'adr'),
  locationPhotoUpload.single('file'),
  async (req, res, next) => {
    try {
      const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
      const access = await assertAgentAccess(req, agent);
      if (access) return res.status(access.status).json({ error: access.error });

      if (!req.file) {
        return res.status(400).json({ error: 'Location photo is required' });
      }

      if (agent.locationPhotoPath) {
        const oldPath = path.join(kycUploadDir, '..', agent.locationPhotoPath);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const filePath = path.posix.join('location', req.file.filename);
      const updated = await prisma.agent.update({
        where: { id: agent.id },
        data: { locationPhotoPath: filePath }
      });

      res.status(201).json({
        location_photo_url: `/uploads/${updated.locationPhotoPath}`
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/kyc-docs',
  requireRoles('manager', 'team_lead', 'adr'),
  kycUpload.single('file'),
  async (req, res, next) => {
    try {
      const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
      const access = await assertAgentAccess(req, agent);
      if (access) return res.status(access.status).json({ error: access.error });

      if (!req.file) {
        return res.status(400).json({ error: 'KYC file is required' });
      }
      if (!req.body.docType) {
        return res.status(400).json({ error: 'docType is required' });
      }
      if (!KYC_DOC_TYPES.includes(req.body.docType)) {
        return res.status(400).json({
          error: `docType must be one of: ${KYC_DOC_TYPES.join(', ')}`
        });
      }

      const doc = await prisma.kycDocument.create({
        data: {
          agentId: agent.id,
          docType: req.body.docType,
          fileName: req.file.originalname,
          filePath: path.posix.join('kyc', req.file.filename),
          mimeType: req.file.mimetype
        }
      });

      await syncKycStatus(agent.id);

      await logAudit({
        scope: 'company',
        companyId: agent.companyId,
        actor: req.user,
        action: 'kyc.uploaded',
        entityType: 'agent',
        entityId: agent.id,
        details: {
          docType: doc.docType,
          docLabel: KYC_DOC_LABELS[doc.docType] || doc.docType,
          fileName: doc.fileName
        }
      });

      res.status(201).json({
        id: doc.id,
        docType: doc.docType,
        docLabel: KYC_DOC_LABELS[doc.docType] || doc.docType,
        fileName: doc.fileName,
        url: `/uploads/${doc.filePath}`,
        uploadedAt: doc.uploadedAt
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id/kyc-docs', async (req, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
    const access = await assertAgentAccess(req, agent);
    if (access) return res.status(access.status).json({ error: access.error });

    const docs = await prisma.kycDocument.findMany({
      where: { agentId: agent.id },
      orderBy: [{ docType: 'asc' }, { id: 'asc' }]
    });

    res.json(
      docs.map((d) => ({
        id: d.id,
        docType: d.docType,
        docLabel: KYC_DOC_LABELS[d.docType] || d.docType,
        fileName: d.fileName,
        mimeType: d.mimeType,
        url: `/uploads/${d.filePath}`,
        uploadedAt: d.uploadedAt
      }))
    );
  } catch (err) {
    next(err);
  }
});

async function resolveKycDocFile(req, res) {
  const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
  const access = await assertAgentAccess(req, agent);
  if (access) { res.status(access.status).json({ error: access.error }); return null; }

  const doc = await prisma.kycDocument.findFirst({
    where: { id: parseInt(req.params.docId, 10), agentId: agent.id }
  });
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return null; }

  const absPath = path.join(kycUploadDir, path.basename(doc.filePath));
  if (!fs.existsSync(absPath)) { res.status(404).json({ error: 'File not found on disk' }); return null; }

  return { doc, absPath };
}

router.get('/:id/kyc-docs/:docId/download', async (req, res, next) => {
  try {
    const result = await resolveKycDocFile(req, res);
    if (!result) return;
    const { doc, absPath } = result;

    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.fileName.replace(/"/g, '')}"`
    );
    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/kyc-docs/:docId/view', async (req, res, next) => {
  try {
    const result = await resolveKycDocFile(req, res);
    if (!result) return;
    const { doc, absPath } = result;

    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
    const access = await assertAgentAccess(req, agent);
    if (access) return res.status(access.status).json({ error: access.error });

    const canEditProfile = userCanEditAgentProfile(req.user);
    const canEditOnboarding =
      req.user.role === 'manager' || req.user.role === 'team_lead';
    const profileKeys = [
      'name',
      'phone',
      'zone',
      'status',
      'national_id',
      'business_type',
      'officer_id'
    ];
    const onboardingKeys = [
      'outlet_name',
      'town_village',
      'personal_phone',
      'business_type_other',
      'competitors_present',
      'branding_present'
    ];

    if (!canEditProfile && profileKeys.some((k) => req.body[k] !== undefined)) {
      return res.status(403).json({ error: 'Not allowed to edit agent profiles' });
    }

    if (!canEditOnboarding && onboardingKeys.some((k) => req.body[k] !== undefined)) {
      return res.status(403).json({ error: 'Not allowed to edit onboarding details' });
    }

    const data = {};
    const map = {
      name: 'name',
      zone: 'zone',
      efloat: 'efloat',
      cash: 'cash',
      status: 'status',
      kyc: 'kyc',
      last_visit: 'lastVisit',
      visits: 'visits',
      national_id: 'nationalId',
      business_type: 'businessType',
      business_type_other: 'businessTypeOther',
      outlet_name: 'outletName',
      town_village: 'townVillage'
    };
    for (const [key, field] of Object.entries(map)) {
      if (req.body[key] !== undefined) data[field] = req.body[key];
    }

    if (req.body.competitors_present !== undefined) {
      data.competitorsPresent = Array.isArray(req.body.competitors_present)
        ? req.body.competitors_present.map(String).filter(Boolean)
        : [];
    }
    if (req.body.branding_present !== undefined) {
      data.brandingPresent = Array.isArray(req.body.branding_present)
        ? req.body.branding_present.map(String).filter(Boolean)
        : [];
    }

    if (req.body.phone !== undefined) {
      const phoneFields = resolveAgentPhone(req.body.phone);
      if (phoneFields.error) {
        return res.status(400).json({ error: phoneFields.error });
      }
      data.phone = phoneFields.phone;
      data.phoneNormalized = phoneFields.phoneNormalized;
    }

    if (req.body.personal_phone !== undefined) {
      const personalFields = resolveAgentPhone(req.body.personal_phone);
      if (personalFields.error) {
        return res.status(400).json({ error: personalFields.error });
      }
      data.personalPhone = personalFields.phone;
      data.personalPhoneNormalized = personalFields.phoneNormalized;
    }

    if (req.body.officer_id !== undefined && req.user.role === 'manager') {
      if (req.body.officer_id === null || req.body.officer_id === '') {
        data.officerId = null;
        data.officer = 'Unassigned';
      } else {
        const assignment = await resolveOfficerAssignment(agent.companyId, {
          officerId: req.body.officer_id,
          fallback: null
        });
        if (!assignment) {
          return res.status(400).json({ error: 'Invalid ADR assignment' });
        }
        data.officerId = assignment.officerId;
        data.officer = assignment.officer;
      }
    }

    const updated = await prisma.agent.update({
      where: { id: req.params.id },
      data
    });
    res.json(serializeAgent(updated));
  } catch (err) {
    if (err.code === 'P2002') {
      return res
        .status(409)
        .json({ error: 'An agent with this phone number already exists' });
    }
    next(err);
  }
});

export default router;
