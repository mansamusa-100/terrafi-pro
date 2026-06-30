export function serializeDelivery(row) {
  return {
    delivery_id: row.deliveryId,
    snapshot_at: row.snapshotAt.toISOString(),
    received_at: row.receivedAt.toISOString(),
    record_count: row.recordCount,
    updated_count: row.updatedCount,
    skipped_count: row.skippedCount,
    unknown_count: row.unknownCount,
    status: row.status
  };
}

export function serializeDeliveryAgent(agent) {
  return {
    agent_number: agent.phoneNormalized,
    agent_id: agent.id,
    name: agent.name,
    zone: agent.zone,
    after_balance: agent.efloat.toFixed(2),
    balance_as_of: agent.floatBalanceAsOf?.toISOString() ?? null
  };
}
