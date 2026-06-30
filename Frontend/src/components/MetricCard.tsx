import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
  icon: React.ReactNode;
  accent?: string;
  onClick?: () => void;
  animDelay?: number;
}
export function MetricCard({
  label,
  value,
  sub,
  subColor,
  icon,
  accent,
  onClick,
  animDelay = 0
}: MetricCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-slate-200 rounded-xl p-5 cursor-default transition-all duration-500 ease-out',
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
      )}
      style={
      onClick && accent ?
      {
        '--hover-border': accent
      } as React.CSSProperties :
      {}
      }
      onMouseEnter={(e) => {
        if (onClick && accent) e.currentTarget.style.borderColor = accent;
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.borderColor = '#E2E8F0'; // slate-200
      }}>
      
      <div className="flex justify-between items-start mb-3">
        <div className="text-xs text-slate-500 font-medium">{label}</div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: accent ? `${accent}15` : '#E3F0FF',
            color: accent || '#1565C0'
          }}>
          
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900 leading-none tracking-tight">
        {value}
      </div>
      {sub &&
      <div
        className={cn(
          'text-xs mt-2 font-medium',
          subColor || 'text-slate-500'
        )}>
        
          {sub}
        </div>
      }
    </div>);

}