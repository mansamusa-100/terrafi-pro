import React, { useMemo, useState } from 'react';
import { Plus, Users, Upload, FileSpreadsheet } from 'lucide-react';
import { AgentCard } from '../components/AgentCard';
import { OnboardingModal } from '../components/OnboardingModal';
import { BulkImportModal } from '../components/BulkImportModal';
import { BulkKycModal } from '../components/BulkKycModal';
import { useAppData } from '../lib/data-context';
import type { Agent } from '../lib/api';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
interface AgentsPageProps {
  searchQ: string;
  onAgentClick: (agent: Agent) => void;
}
export function AgentsPage({ searchQ, onAgentClick }: AgentsPageProps) {
  const { agents, createAgent } = useAppData();
  const { user } = useAuth();
  const canOnboard = user ? can(user.role, 'onboardAgent') : false;
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [kycBulkOpen, setKycBulkOpen] = useState(false);
  const tabs = [
  ['all', 'All agents'],
  ['active', 'Active'],
  ['low_float', 'Low float'],
  ['critical', 'Critical'],
  ['suspended', 'Suspended']];

  const filteredAndSortedAgents = useMemo(() => {
    let list = agents.filter((a) => filter === 'all' || a.status === filter);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(
        (a) =>
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.zone.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'float') return b.efloat - a.efloat;
      return b.score - a.score;
    });
  }, [filter, searchQ, sort, agents]);
  const handleAddAgent = () => setOnboardingOpen(true);
  return (
    <div className="page-pad">
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1 overflow-x-auto max-w-full">
          {tabs.map(([id, label]) =>
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              filter === id ?
              'bg-white text-slate-900 shadow-sm' :
              'text-slate-600 hover:text-slate-900'
            )}>
            
              {label}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center sm:ml-auto">
          <span className="text-xs text-slate-500 font-medium">Sort by:</span>
          {[
          ['name', 'Name'],
          ['float', 'Float'],
          ['score', 'Score']].
          map(([id, label]) =>
          <button
            key={id}
            onClick={() => setSort(id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              sort === id ?
              'border-apsBlue bg-apsBlueLt text-apsBlue' :
              'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            )}>
            
              {label}
            </button>
          )}
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
      </div>

      {filteredAndSortedAgents.length > 0 ?
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAndSortedAgents.map((agent) =>
        <AgentCard key={agent.id} agent={agent} onClick={onAgentClick} />
        )}
        </div> :

      <div className="text-center py-16 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">No agents match your search</p>
          <p className="text-xs mt-1">
            Try adjusting your filters or search query
          </p>
        </div>
      }

      <OnboardingModal
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onSubmit={createAgent}
      />
      <BulkImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <BulkKycModal open={kycBulkOpen} onClose={() => setKycBulkOpen(false)} />
    </div>);

}