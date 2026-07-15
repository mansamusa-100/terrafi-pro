import React from 'react';
import { cn } from '../lib/utils';
import type { AppBranding } from '../lib/rbac';

interface BrandMarkProps {
  branding: AppBranding;
  size?: 'sm' | 'md';
  className?: string;
}

export function brandInitial(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return 'TP';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function BrandMark({ branding, size = 'md', className }: BrandMarkProps) {
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const textSize = size === 'sm' ? 'text-sm' : 'text-lg';

  if (branding.logo_url) {
    return (
      <div
        className={cn(
          dim,
          'rounded-lg overflow-hidden shrink-0 bg-white shadow-sm ring-1 ring-black/5',
          className
        )}>
        <img
          src={branding.logo_url}
          alt=""
          className="block w-full h-full object-cover object-center"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        dim,
        'bg-apsBlue rounded-lg flex items-center justify-center shrink-0 shadow-sm',
        className
      )}>
      <span className={cn('text-white font-bold', textSize)}>
        {brandInitial(branding.title)}
      </span>
    </div>
  );
}
