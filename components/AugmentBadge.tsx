"use client";
import { useState } from 'react';

type AugmentBadgeProps = {
  augmentId: number;
  augmentName: string;
};

export function AugmentBadge({ augmentId, augmentName }: AugmentBadgeProps) {
  const [hasError, setHasError] = useState(false);
  const iconPath = `/augments/${augmentId}.png`;

  if (hasError || !augmentId) {
    // Fallback: Text Badge
    return (
      <span 
        className="px-2 py-1 rounded bg-stone-800 text-gold text-xs font-bold border border-gold/20 truncate max-w-[120px]"
        title={augmentName}
      >
        {augmentName}
      </span>
    );
  }

  // Primary: Image Icon
  return (
    <img 
      src={iconPath} 
      alt={augmentName} 
      className="h-8 w-8 rounded-full border border-gold/30 bg-black/40"
      onError={() => setHasError(true)}
      title={augmentName}
    />
  );
}
