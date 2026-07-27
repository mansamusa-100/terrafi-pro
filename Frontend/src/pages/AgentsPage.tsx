import React, { useMemo, useState } from 'react';
import { Plus, Users, Upload, FileSpreadsheet, Navigation, Search } from 'lucide-react';
import { AgentCard } from '../components/AgentCard';
import { OnboardingModal } from '../components/OnboardingModal';
import { BulkImportModal } from '../components/BulkImportModal';
import { BulkKycModal } from '../components/BulkKycModal';
import { useAppData } from '../lib/data-context';
import type { Agent } from '../lib/api';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { useUserLocation } from '../lib/useUserLocation';
import { compareAgentDistance } from '../lib/agent-distance';
import { Pagination } from '../components/Pagination';
import { PAGE_SIZE, useClientPagination } from '../lib/useClientPagination';

interface AgentsPageProps {
  searchQ: string;
  setSearchQ: (q: string) => void;
  onAgentClick: (agent: Agent) => void;
}

export function AgentsPage({ searchQ, setSearchQ, onAgentClick }: AgentsPageProps) {
  const { agents, createAgent } = useAppData();
  const { user } = useAuth();
  const { coords: userCoords } = useUserLocation();
  const canOnboard = user ? can(user.role, 'onboardAgent') : false;
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('distance');
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [kycBulkOpen, setKycBulkOpen] = useState(false);

  const tabs = [
    ['all', 'All agents'],
    ['active', 'Active'],
    ['low_float', 'Low float'],
    ['critical', 'Critical'],
    ['suspended', 'Suspended']
  ];

  const filteredAndSortedAgents = useMemo(() => {
    let list = agents.filter((a) => filter === 'all' || a.status === filter);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.zone.toLowerCase().includes(q) ||
          (a.outlet_name?.toLowerCase().includes(q) ?? false) ||
          (a.town_village?.toLowerCase().includes(q) ?? false) ||
          (a.phone?.toLowerCase().includes(q) ?? false)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === 'distance') return compareAgentDistance(a, b, userCoords);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'float') return b.efloat - a.efloat;
      return b.score - a.score;
    });
  }, [filter, searchQ, sort, agents, userCoords]);

  const {
    pageItems: pageAgents,
    total: agentTotal,
    limit: agentLimit,
    offset: agentOffset,
    setOffset: setAgentOffset
  } = useClientPagination(
    filteredAndSortedAgents,
    PAGE_SIZE.cards,
    `${filter}|${searchQ}|${sort}`
  );

  const handleAddAgent = () => setOnboardingOpen(true);

  return (
    <div className="page-pad">
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1 overflow-x-auto max-w-full">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  filter === id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 gap-2 flex-1 min-w-[180px] max-w-sm sm:ml-auto">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search name, ID, zone, phone…"
              aria-label="Search agents"
              className="bg-transparent border-none outline-none text-xs text-slate-800 w-full placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500 font-medium">Sort by:</span>
          {[
            ['distance', 'Nearest'],
            ['name', 'Name'],
            ['float', 'Float'],
            ['score', 'Score']
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1',
                sort === id
                  ? 'border-apsBlue bg-apsBlueLt text-apsBlue'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              )}>
              {id === 'distance' && <Navigation className="w-3 h-3" />}
              {label}
            </button>
          ))}
          {canOnboard && (
            <>
              <button
                onClick={() => setImportOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium flex items-center gap-2 hover:border-slate-300 transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                Import CSV
              </button>
              <button
                onClick={() => setKycBulkOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium flex items-center gap-2 hover:border-slate-300 transition-colors">
                <Upload className="w-4 h-4" />
                Bulk KYC
              </button>
              <button
                onClick={handleAddAgent}
                className="px-4 py-1.5 rounded-lg bg-navy text-white text-xs font-medium flex items-center gap-2 hover:bg-navyMid transition-colors">
                <Plus className="w-4 h-4" />
                Add agent
              </button>
            </>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-500 mb-4 font-medium">
        {filteredAndSortedAgents.length} agents found
        {sort === 'distance' && userCoords && (
          <span className="text-slate-400"> · sorted by your GPS location</span>
        )}
      </div>

      {filteredAndSortedAgents.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {pageAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                userCoords={userCoords}
                onClick={onAgentClick}
              />
            ))}
          </div>
          <Pagination
            total={agentTotal}
            limit={agentLimit}
            offset={agentOffset}
            onPageChange={setAgentOffset}
            className="mt-4"
          />
        </>
      ) : (
        <div className="text-center py-16 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">No agents match your search</p>
          <p className="text-xs mt-1">Try adjusting your filters or search query</p>
        </div>
      )}

      <OnboardingModal
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onSubmit={createAgent}
        onCreated={onAgentClick}
      />
      <BulkImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <BulkKycModal open={kycBulkOpen} onClose={() => setKycBulkOpen(false)} />
    </div>
  );
}
