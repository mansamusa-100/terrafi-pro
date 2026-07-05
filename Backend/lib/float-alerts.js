import { prisma } from './prisma.js';
import { getOrCreateCompanySettings } from './company-settings.js';
import {
  notifyFloatAlertCreated,
  notifyFloatAlertResolved
} from './notifications.js';

function formatAmount(n) {
  return `D ${Number(n).toLocaleString('en-US')}`;
}

export function floatLevels(total, efloat, threshold) {
  const criticalLevel = Math.min(3000, Math.floor(threshold * 0.6));
  if (total < criticalLevel || efloat < criticalLevel) {
    return 'critical';
  }
  if (total < threshold || efloat < threshold) {
    return 'warning';
  }
  return null;
}

/** Reconcile float alerts for one company from live agent balances. */
export async function syncFloatAlerts(companyId) {
  const settings = await getOrCreateCompanySettings(companyId);
  const threshold = settings.defaultFloatThreshold;

  const agents = await prisma.agent.findMany({
    where: { companyId, status: { not: 'suspended' } }
  });

  const openAlerts = await prisma.alert.findMany({
    where: {
      companyId,
      dismissedAt: null,
      agentId: { not: null },
      type: { in: ['critical', 'warning'] }
    }
  });
  const alertByAgent = new Map(openAlerts.map((a) => [a.agentId, a]));

  for (const agent of agents) {
    const total = agent.efloat + agent.cash;
    const level = floatLevels(total, agent.efloat, threshold);
    const existing = alertByAgent.get(agent.id);

    if (level) {
      const title =
        level === 'critical' ? 'Critical low float' : 'Low float warning';
      const body =
        level === 'critical'
          ? `${agent.name} — ${formatAmount(agent.efloat)} e-float remaining`
          : `${agent.name} — ${formatAmount(agent.efloat)} below threshold (${formatAmount(threshold)})`;

      if (existing) {
        if (existing.type !== level || existing.body !== body) {
          await prisma.alert.update({
            where: { id: existing.id },
            data: { type: level, title, body, time: 'Just now' }
          });
        }
      } else {
        await prisma.alert.create({
          data: {
            companyId,
            type: level,
            title,
            body,
            time: 'Just now',
            agentId: agent.id
          }
        });
        await notifyFloatAlertCreated(agent, level);
      }
    } else if (existing) {
      await prisma.alert.update({
        where: { id: existing.id },
        data: { dismissedAt: new Date(), time: 'Resolved' }
      });
      await notifyFloatAlertResolved(agent);
    }
  }
}

export async function syncFloatAlertsForAgent(agentId) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return;
  await syncFloatAlerts(agent.companyId);
}
