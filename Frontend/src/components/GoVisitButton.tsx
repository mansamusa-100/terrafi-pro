import React from 'react';
import { Navigation } from 'lucide-react';
import { toast } from 'sonner';
import type { Agent } from '../lib/api';
import {
  agentVisitLabel,
  hasNavigableLocation,
  openVisitDirections
} from '../lib/visit-directions';
import { cn } from '../lib/utils';

type AgentLocation = Pick<
  Agent,
  'lat' | 'lng' | 'name' | 'outlet_name' | 'town_village' | 'zone'
>;

interface GoVisitButtonProps {
  agent: AgentLocation;
  variant?: 'primary' | 'outline' | 'ghost' | 'compact';
  className?: string;
  fullWidth?: boolean;
}

export function GoVisitButton({
  agent,
  variant = 'primary',
  className,
  fullWidth = false
}: GoVisitButtonProps) {
  if (!hasNavigableLocation(agent.lat, agent.lng)) return null;

  const label = agentVisitLabel(agent);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!openVisitDirections(agent)) {
      toast.error('This agent has no GPS location on file.');
    }
  };

  const styles = {
    primary:
      'bg-apsBlue hover:bg-apsBlueMid text-white border border-transparent shadow-sm',
    outline:
      'bg-white hover:bg-apsBlueLt/30 text-apsBlue border border-apsBlue/30',
    ghost:
      'bg-white/10 hover:bg-white/20 text-white border border-white/20',
    compact:
      'bg-apsBlueLt/60 hover:bg-apsBlueLt text-apsBlue border border-apsBlue/20'
  };

  const sizeStyles =
    variant === 'compact'
      ? 'px-2.5 py-1 text-[10px] gap-1'
      : 'px-3.5 py-2 text-xs gap-1.5';

  return (
    <button
      type="button"
      title={`Directions to ${label}`}
      aria-label={`Go visit ${label} — open directions in maps`}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded-lg transition-colors',
        sizeStyles,
        styles[variant],
        fullWidth && 'w-full',
        className
      )}>
      <Navigation className={variant === 'compact' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      Go Visit
    </button>
  );
}
