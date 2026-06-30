import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
interface Alert {
  type: 'critical' | 'warning';
  title: string;
  body: string;
  time: string;
  agent: string | null;
}
interface AlertItemProps {
  alert: Alert;
}
export function AlertItem({ alert }: AlertItemProps) {
  const isCrit = alert.type === 'critical';
  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg border mb-2 last:mb-0',
        isCrit ?
        'bg-apsRedLt border-apsRed/20' :
        'bg-apsAmberLt border-apsAmber/20'
      )}>
      
      {isCrit ?
      <AlertCircle className="w-4 h-4 text-apsRed shrink-0 mt-0.5" /> :

      <AlertTriangle className="w-4 h-4 text-apsAmber shrink-0 mt-0.5" />
      }
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-xs font-semibold',
            isCrit ? 'text-apsRed' : 'text-amber-800'
          )}>
          
          {alert.title}
        </div>
        <div
          className={cn(
            'text-xs mt-1',
            isCrit ? 'text-red-900' : 'text-amber-900'
          )}>
          
          {alert.body}
        </div>
      </div>
      <div
        className={cn(
          'text-[10px] whitespace-nowrap pt-0.5 font-medium',
          isCrit ? 'text-red-700' : 'text-amber-700'
        )}>
        
        {alert.time}
      </div>
    </div>);

}