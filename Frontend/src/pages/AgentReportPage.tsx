import React, { useEffect, useState } from 'react';
import { AgentReportSection } from '../components/AgentReportSection';
import type { Agent } from '../lib/api';

interface AgentReportPageProps {
  onAgentClick?: (agent: Agent) => void;
}

export function AgentReportPage({ onAgentClick }: AgentReportPageProps) {
  return (
    <div className="page-pad">
      <AgentReportSection onAgentClick={onAgentClick} />
    </div>
  );
}
