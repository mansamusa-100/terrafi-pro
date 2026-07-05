import { prisma } from './prisma.js';
import { normalizePhone } from './phone.js';
import { syncFloatAlerts } from './float-alerts.js';

const BATCH_SIZE = 500;

export function parseBalance(afterBalance) {
  const value = Number.parseFloat(afterBalance);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid balance: ${afterBalance}`);
  }
  return Math.round(value);
}

export function statusFromEfloat(efloat) {
  if (efloat < 5000) return 'critical';
  if (efloat < 20000) return 'low_float';
  return 'active';
}

export async function isDeliveryProcessed(deliveryId) {
  const row = await prisma.floatDelivery.findUnique({
    where: { deliveryId },
    select: { status: true }
  });
  return row?.status === 'completed';
}

export async function mergeAgentFloatSnapshot({
  companyId,
  deliveryId,
  snapshotAt,
  agents
}) {
  const snapshotDate = new Date(snapshotAt);
  if (Number.isNaN(snapshotDate.getTime())) {
    throw new Error('Invalid snapshot_at');
  }

  const existingAgents = await prisma.agent.findMany({
    where: { companyId, phoneNormalized: { not: null } },
    select: {
      id: true,
      phoneNormalized: true,
      lastFloatSnapshotAt: true
    }
  });

  const byPhone = new Map(existingAgents.map((a) => [a.phoneNormalized, a]));

  const updates = [];
  let unknownCount = 0;
  let skippedCount = 0;

  for (const row of agents) {
    const phoneNormalized = normalizePhone(row.agent_number);
    if (!phoneNormalized) {
      unknownCount += 1;
      continue;
    }

    const agent = byPhone.get(phoneNormalized);
    if (!agent) {
      unknownCount += 1;
      continue;
    }

    if (
      agent.lastFloatSnapshotAt &&
      snapshotDate <= agent.lastFloatSnapshotAt
    ) {
      skippedCount += 1;
      continue;
    }

    const balanceAsOf = new Date(row.balance_as_of);
    if (Number.isNaN(balanceAsOf.getTime())) {
      throw new Error(`Invalid balance_as_of for agent ${row.agent_number}`);
    }

    const efloat = parseBalance(row.after_balance);
    updates.push({
      id: agent.id,
      efloat,
      floatBalanceAsOf: balanceAsOf,
      lastFloatSnapshotAt: snapshotDate,
      lastFloatDeliveryId: deliveryId,
      status: statusFromEfloat(efloat)
    });
  }

  let updatedCount = 0;
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const chunk = updates.slice(i, i + BATCH_SIZE);
      await Promise.all(
        chunk.map((u) =>
          tx.agent.update({
            where: { id: u.id },
            data: {
              efloat: u.efloat,
              floatBalanceAsOf: u.floatBalanceAsOf,
              lastFloatSnapshotAt: u.lastFloatSnapshotAt,
              lastFloatDeliveryId: u.lastFloatDeliveryId,
              status: u.status
            }
          })
        )
      );
      updatedCount += chunk.length;
    }

    await tx.floatDelivery.create({
      data: {
        deliveryId,
        companyId,
        snapshotAt: snapshotDate,
        recordCount: agents.length,
        updatedCount,
        skippedCount,
        unknownCount,
        status: 'completed'
      }
    });
  });

  await syncFloatAlerts(companyId);

  return { updatedCount, skippedCount, unknownCount };
}
