import { LayoutDashboard, Map, MapPin, Users } from 'lucide-react';
import { MobileFieldBar } from './MobileFieldBar';

interface TeamLeadFieldBarProps {
  active: string;
  setActive: (page: string) => void;
  onLogVisit: () => void;
}

const ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
  { id: 'agents', icon: Users, label: 'Agents' },
  { id: 'visits', icon: Map, label: 'Visits' },
  { id: 'map', icon: MapPin, label: 'Map' }
] as const;

export function TeamLeadFieldBar({
  active,
  setActive,
  onLogVisit
}: TeamLeadFieldBarProps) {
  return (
    <MobileFieldBar
      active={active}
      setActive={setActive}
      items={ITEMS}
      fab={{ onClick: onLogVisit, ariaLabel: 'Log visit' }}
      ariaLabel="Team lead field navigation"
    />
  );
}
