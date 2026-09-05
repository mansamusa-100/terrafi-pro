import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { companyFilter, visitOfficerFilter } from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import {
  managerOrInternalCapability,
  requireRolesOrInternalCapability
} from '../lib/internal-capabilities.js';
import { toCsv, csvResponse } from '../lib/csv-export.js';
import { buildAdrPerformance } from '../lib/performance.js';
import { todayISO } from '../middleware/user.js';
import {
  buildAgentRegistryReport,
  agentRegistryCsvRows,
  AGENT_REGISTRY_CSV_HEADERS
} from '../lib/agent-registry.js';
import {
  buildOfficerReport,
  officerReportCsvSections,
  OFFICER_CSV_HEADERS
} from '../lib/officer-report.js';
import {
  buildAgentListByAdr,
  agentListByAdrCsvRows,
  AGENT_LIST_BY_ADR_CSV_HEADERS
} from '../lib/agent-list-by-adr.js';

const router = Router();

function dateRange(query) {
  const today = todayISO();
  const from = query.from || `${today.slice(0, 7)}-01`;
  const to = query.to || today;
  return { from, to };
}

router.get(
  '/agents',
  managerOrInternalCapability('export_data'),
  async (req, res, next) => {
    try {
      const companyId = companyFilter(req.user) || 'co-aps';
      const agents = await prisma.agent.findMany({
        where: { companyId },
        orderBy: { name: 'asc' }
      });

      const csv = toCsv(
        [
          'id',
          'name',
          'phone',
          'zone',
          'officer',
          'status',
          'kyc',
          'efloat',
          'cash',
          'visits',
          'score',
          'last_visit'
        ],
        agents.map((a) => [
          a.id,
          a.name,
          a.phone,
          a.zone,
          a.officer,
          a.status,
          a.kyc,
          a.efloat,
          a.cash,
          a.visits,
          a.score,
          a.lastVisit
        ])
      );

      csvResponse(res, `agents-${todayISO()}.csv`, csv);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/visits',
  requireRolesOrInternalCapability(['manager', 'team_lead', 'adr'], 'export_data'),
  async (req, res, next) => {
    try {
      const companyId = companyFilter(req.user) || 'co-aps';
      const { from, to } = dateRange(req.query);

      const where = {
        companyId,
        visitDate: { gte: from, lte: to }
      };
      const filter = visitOfficerFilter(req.user);
      if (filter) where.officer = filter;

      const visits = await prisma.visit.findMany({
        where,
        orderBy: [{ visitDate: 'asc' }, { time: 'asc' }]
      });

      const csv = toCsv(
        [
          'id',
          'visit_date',
          'time',
          'agent',
          'officer',
          'zone',
          'type',
          'status',
          'efloat',
          'cash',
          'gps_verified',
          'notes'
        ],
        visits.map((v) => [
          v.id,
          v.visitDate,
          v.time,
          v.agentName,
          v.officer,
          v.zone,
          v.type,
          v.status,
          v.efloat,
          v.cash,
          v.gpsVerified ? 'yes' : 'no',
          v.notes
        ])
      );

      csvResponse(res, `visits-${from}-to-${to}.csv`, csv);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/adr-performance',
  managerOrInternalCapability('export_data'),
  async (req, res, next) => {
    try {
      const companyId = companyFilter(req.user) || 'co-aps';
      const rows = await buildAdrPerformance(companyId);

      const csv = toCsv(
        [
          'name',
          'zone',
          'agents_assigned',
          'visits_done',
          'visit_target',
          'visit_rate_pct',
          'visits_pending',
          'visits_missed',
          'kyc_verified',
          'kyc_rate_pct',
          'onboarded_month',
          'score'
        ],
        rows.map((r) => [
          r.name,
          r.zone,
          r.agents,
          r.visits_done,
          r.visit_target,
          r.visit_rate,
          r.visits_pending,
          r.visits_missed,
          r.kyc_verified,
          r.kyc_rate,
          r.onboarded_month,
          r.score
        ])
      );

      csvResponse(res, `adr-performance-${todayISO()}.csv`, csv);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/compliance',
  managerOrInternalCapability('export_data'),
  async (req, res, next) => {
    try {
      const companyId = companyFilter(req.user) || 'co-aps';
      const agents = await prisma.agent.findMany({
        where: { companyId },
        orderBy: { name: 'asc' }
      });

      const csv = toCsv(
        ['id', 'name', 'zone', 'officer', 'kyc', 'status', 'efloat', 'cash'],
        agents.map((a) => [
          a.id,
          a.name,
          a.zone,
          a.officer,
          a.kyc,
          a.status,
          a.efloat,
          a.cash
        ])
      );

      csvResponse(res, `compliance-${todayISO()}.csv`, csv);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/agent-report',
  requireRolesOrInternalCapability(['manager', 'team_lead', 'adr'], 'export_data'),
  async (req, res, next) => {
    try {
      const report = await buildAgentRegistryReport(req.user, {
        ...req.query,
        limit: '10000',
        offset: '0'
      });
      const csv = toCsv(AGENT_REGISTRY_CSV_HEADERS, agentRegistryCsvRows(report));
      const { from, to } = report.period;
      csvResponse(res, `agent-report-${from}-to-${to}.csv`, csv);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/agent-list-by-adr',
  requireRolesOrInternalCapability(['manager', 'team_lead', 'adr'], 'export_data'),
  async (req, res, next) => {
    try {
      const report = await buildAgentListByAdr(req.user, req.query);
      const csv = toCsv(AGENT_LIST_BY_ADR_CSV_HEADERS, agentListByAdrCsvRows(report));
      const { from, to } = report.period;
      csvResponse(res, `agent-list-by-adr-${from}-to-${to}.csv`, csv);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/officer-report',
  requireRolesOrInternalCapability(['manager', 'team_lead', 'adr'], 'export_data'),
  async (req, res, next) => {
    try {
      const report = await buildOfficerReport(req.user, req.query);
      const table = req.query.table || 'visit_achieved';
      const sections = officerReportCsvSections(report);
      const headers = OFFICER_CSV_HEADERS[table];
      const rows = sections[table];
      if (!headers || !rows) {
        return res.status(400).json({
          error: 'Invalid table — use visit_achieved, work_duration, or team_activity'
        });
      }
      const csv = toCsv(headers, rows);
      const { from, to } = report.period;
      csvResponse(res, `officer-report-${table}-${from}-to-${to}.csv`, csv);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
