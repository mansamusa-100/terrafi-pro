import { LayoutDashboard, Map, Users, ClipboardList } from 'lucide-react';
import { MobileFieldBar } from './MobileFieldBar';

interface AdrFieldBarProps {
  active: string;
  setActive: (page: string) => void;
  onLogVisit: () => void;
}

const ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
  { id: 'visits', icon: Map, label: 'Visits' },
  { id: 'agents', icon: Users, label: 'Agents' },
  {
    id: 'performance-officer-report',
    icon: ClipboardList,
    label: 'Report',
    isActive: (page: string) =>
      page === 'performance-officer-report' ||
      page === 'performance-agent-report' ||
      page === 'performance-agent-list-by-adr' ||
      page === 'performance'
  }
] as const;

export function AdrFieldBar({ active, setActive, onLogVisit }: AdrFieldBarProps) {
  return (
    <MobileFieldBar
      active={active}
      setActive={setActive}
      items={[...ITEMS]}
      fab={{ onClick: onLogVisit, ariaLabel: 'Log visit' }}
      ariaLabel="ADR field navigation"
    />
  );
}
