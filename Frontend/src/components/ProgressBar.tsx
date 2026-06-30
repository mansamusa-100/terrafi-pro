import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: string;
  animated?: boolean;
}
export function ProgressBar({
  value,
  max = 100,
  color = 'bg-apsBlue',
  height = 'h-1.5',
  animated = true
}: ProgressBarProps) {
  const [width, setWidth] = useState(0);
  const pct = Math.round(value / max * 100);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 100);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div
      className={cn('w-full bg-slate-100 rounded-full overflow-hidden', height)}>
      
      <div
        className={cn(
          'h-full rounded-full',
          color,
          animated && 'transition-all duration-700 ease-out'
        )}
        style={{
          width: `${width}%`
        }} />
      
    </div>);

}