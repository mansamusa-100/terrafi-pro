import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { companyFilter } from '../middleware/user.js';
import { requireRoles } from '../middleware/auth.js';
import {
  serializeDelivery,
  serializeDeliveryAgent
} from '../lib/float-sync.js';

const router = Router();

router.use(requireRoles('manager'));

router.get('/deliveries', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user) || 'co-aps';
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const where = { companyId };

    const [total, deliveries, latestRow] = await Promise.all([
      prisma.floatDelivery.count({ where }),
      prisma.floatDelivery.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.floatDelivery.findFirst({
        where,
        orderBy: { receivedAt: 'desc' }
      })
    ]);

    res.json({
      latest: latestRow ? serializeDelivery(latestRow) : null,
      deliveries: deliveries.map(serializeDelivery),
      total,
      limit,
      offset
    });
  } catch (err) {
    next(err);
  }
});

router.get('/deliveries/:deliveryId', async (req, res, next) => {
  try {
    const companyId = companyFilter(req.user) || 'co-aps';
    const deliveryId = req.params.deliveryId;
    const limit = Math.min(parseInt(req.query.limit || '25', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const summaryOnly = req.query.summary === 'true';

    const delivery = await prisma.floatDelivery.findFirst({
      where: { deliveryId, companyId }
    });

    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const agentWhere = { companyId, lastFloatDeliveryId: deliveryId };

    const [agentsTotal, balanceAgg] = await Promise.all([
      prisma.agent.count({ where: agentWhere }),
      prisma.agent.aggregate({
        where: agentWhere,
        _sum: { efloat: true }
      })
    ]);

    const totalBalance = balanceAgg._sum.efloat ?? 0;

    const payload = {
      schema_version: 1,
      ...serializeDelivery(delivery),
      agents_in_payload: delivery.recordCount,
      agents_updated: agentsTotal,
      total_after_balance: totalBalance.toFixed(2)
    };

    if (summaryOnly) {
      return res.json(payload);
    }

    const agents = await prisma.agent.findMany({
      where: agentWhere,
      orderBy: [{ efloat: 'asc' }, { name: 'asc' }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        zone: true,
        phoneNormalized: true,
        efloat: true,
        floatBalanceAsOf: true
      }
    });

    res.json({
      ...payload,
      agents: agents.map(serializeDeliveryAgent),
      agents_total: agentsTotal,
      limit,
      offset,
      showing: agents.length
    });
  } catch (err) {
    next(err);
  }
});

export default router;
