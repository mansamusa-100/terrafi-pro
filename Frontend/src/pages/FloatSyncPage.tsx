import React, { useCallback, useEffect, useState } from 'react';
import {
  Radio,
  RefreshCw,
  ChevronRight,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { cn } from '../lib/utils';
import {
  api,
  type FloatDeliveryDetail,
  type FloatDeliverySummary
} from '../lib/api';

const DELIVERY_PAGE_SIZE = 10;
const AGENT_PAGE_SIZE = 25;

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function shortId(id: string) {
  return id.slice(0, 8);
}

export function FloatSyncPage() {
  const [deliveries, setDeliveries] = useState<FloatDeliverySummary[]>([]);
  const [latestSync, setLatestSync] = useState<FloatDeliverySummary | null>(null);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [deliveryOffset, setDeliveryOffset] = useState(0);
  const [listLoading, setListLoading] = useState(true);

  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [deliveryDetail, setDeliveryDetail] = useState<FloatDeliveryDetail | null>(null);
  const [agentOffset, setAgentOffset] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDeliveries = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await api.floatSync.deliveries({
        limit: DELIVERY_PAGE_SIZE,
        offset: deliveryOffset
      });
      setDeliveries(data.deliveries);
      setLatestSync(data.latest);
      setDeliveryTotal(data.total);
    } catch {
      setDeliveries([]);
      setLatestSync(null);
      setDeliveryTotal(0);
    } finally {
      setListLoading(false);
    }
  }, [deliveryOffset]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  useEffect(() => {
    setAgentOffset(0);
  }, [selectedDeliveryId]);

  useEffect(() => {
    if (!selectedDeliveryId) {
      setDeliveryDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    api.floatSync
      .deliveryDetail(selectedDeliveryId, {
        limit: AGENT_PAGE_SIZE,
        offset: agentOffset
      })
      .then((detail) => {
        if (!cancelled) setDeliveryDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setDeliveryDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDeliveryId, agentOffset]);

  const handleDeliveryPage = (offset: number) => {
    setDeliveryOffset(offset);
    setSelectedDeliveryId(null);
  };

  return (
    <div className="page-pad">
      <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200/80">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Sensitive — manager only</p>
          <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
            biReports float sync deliveries and decrypted balance snapshots. This log is
            restricted to network managers and is not visible to internal staff, field
            officers, or agents.
          </p>
        </div>
      </div>

      {latestSync && (
        <div className="metric-grid mb-6">
          <MetricCard
            label="Last snapshot"
            value={formatWhen(latestSync.snapshot_at)}
            icon={<Radio className="w-5 h-5" />}
            accent="#1565C0"
          />
          <MetricCard
            label="Agents in payload"
            value={latestSync.record_count.toLocaleString()}
            icon={<Lock className="w-5 h-5" />}
            accent="#00897B"
          />
          <MetricCard
            label="Updated"
            value={latestSync.updated_count.toLocaleString()}
            sub={`${latestSync.unknown_count} unknown · ${latestSync.skipped_count} skipped`}
            icon={<RefreshCw className="w-5 h-5" />}
            accent="#F59E0B"
          />
          <MetricCard
            label="Total deliveries"
            value={deliveryTotal.toLocaleString()}
            sub="Recorded in sync log"
            icon={<Radio className="w-5 h-5" />}
            accent="#6D28D9"
          />
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Delivery history</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Select a delivery to view the agent balance report
            </p>
          </div>
          <button
            type="button"
            onClick={loadDeliveries}
            disabled={listLoading}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-apsBlue disabled:opacity-50">
            <RefreshCw className={cn('w-3.5 h-3.5', listLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {listLoading && deliveries.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">Loading deliveries…</p>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            No float deliveries received yet from biReports.
          </p>
        ) : (
          <>
            <DataTable minWidth="640px">
              <div className="grid grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-3 pb-2 mb-2 border-b border-slate-200">
                {['Received', 'Snapshot', 'Payload', 'Updated', 'Unknown', ''].map((h) => (
                  <div
                    key={h || 'action'}
                    className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {h}
                  </div>
                ))}
              </div>

              {deliveries.map((d) => (
                <button
                  key={d.delivery_id}
                  type="button"
                  onClick={() => setSelectedDeliveryId(d.delivery_id)}
                  className={cn(
                    'w-full grid grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-3 py-2.5 border-b border-slate-100 last:border-0 items-center text-left text-xs hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors',
                    selectedDeliveryId === d.delivery_id && 'bg-apsBlueLt/60'
                  )}>
                  <div className="text-slate-700">{formatWhen(d.received_at)}</div>
                  <div className="text-slate-500">{formatWhen(d.snapshot_at)}</div>
                  <div className="font-medium text-slate-900">{d.record_count}</div>
                  <div className="font-medium text-apsGreen">{d.updated_count}</div>
                  <div className="text-slate-600">{d.unknown_count}</div>
                  <div className="flex items-center justify-end gap-1 text-apsBlue font-medium">
                    <span className="font-mono text-[10px]">{shortId(d.delivery_id)}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </DataTable>

            <Pagination
              total={deliveryTotal}
              limit={DELIVERY_PAGE_SIZE}
              offset={deliveryOffset}
              onPageChange={handleDeliveryPage}
            />
          </>
        )}
      </div>

      {selectedDeliveryId && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Delivery detail report
          </h3>
          <p className="text-[11px] text-slate-500 font-mono mb-4 break-all">
            {selectedDeliveryId}
          </p>

          {detailLoading && !deliveryDetail ? (
            <p className="text-sm text-slate-500 py-8 text-center">Loading detail…</p>
          ) : !deliveryDetail ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Could not load delivery detail.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-slate-50 rounded-lg text-xs">
                <div>
                  <div className="text-slate-500 mb-0.5">Agents in payload</div>
                  <div className="font-semibold">{deliveryDetail.agents_in_payload}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Matched & updated</div>
                  <div className="font-semibold text-apsGreen">
                    {deliveryDetail.agents_updated}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Total after_balance</div>
                  <div className="font-semibold">
                    D {Number(deliveryDetail.total_after_balance).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Skipped / unknown</div>
                  <div className="font-semibold">
                    {deliveryDetail.skipped_count} / {deliveryDetail.unknown_count}
                  </div>
                </div>
              </div>

              {deliveryDetail.agents && deliveryDetail.agents.length > 0 ? (
                <>
                  <DataTable minWidth="520px">
                    <div className="grid grid-cols-[0.8fr_1.2fr_1fr_1fr_1fr] gap-3 pb-2 mb-2 border-b border-slate-200">
                      {['Agent #', 'Name', 'Zone', 'after_balance', 'balance_as_of'].map(
                        (h) => (
                          <div
                            key={h}
                            className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {h}
                          </div>
                        )
                      )}
                    </div>
                    {deliveryDetail.agents.map((row) => (
                      <div
                        key={row.agent_id}
                        className="grid grid-cols-[0.8fr_1.2fr_1fr_1fr_1fr] gap-3 py-2 border-b border-slate-100 last:border-0 items-center text-xs">
                        <div className="font-mono text-slate-700">
                          {row.agent_number ?? '—'}
                        </div>
                        <div className="font-medium text-slate-900 truncate">{row.name}</div>
                        <div className="text-slate-500 truncate">{row.zone}</div>
                        <div className="font-bold text-slate-900">
                          D {Number(row.after_balance).toLocaleString()}
                        </div>
                        <div className="text-slate-500">
                          {row.balance_as_of ? formatWhen(row.balance_as_of) : '—'}
                        </div>
                      </div>
                    ))}
                  </DataTable>

                  <Pagination
                    total={deliveryDetail.agents_total ?? 0}
                    limit={AGENT_PAGE_SIZE}
                    offset={agentOffset}
                    onPageChange={setAgentOffset}
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500 py-6 text-center">
                  No agents were updated in this delivery (all skipped or unknown).
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
