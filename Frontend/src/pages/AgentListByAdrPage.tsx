import { AgentListByAdrSection } from '../components/AgentListByAdrSection';
import type { Agent } from '../lib/api';

interface AgentListByAdrPageProps {
  onAgentClick?: (agent: Agent) => void;
}

export function AgentListByAdrPage({ onAgentClick }: AgentListByAdrPageProps) {
  return (
    <div className="page-pad">
      <AgentListByAdrSection onAgentClick={onAgentClick} />
    </div>
  );
}
