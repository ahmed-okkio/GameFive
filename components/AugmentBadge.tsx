"use client";
import { useState } from 'react';
import Image from 'next/image';
import augmentMap from "@/lib/riot/augment-map.json";

type AugmentBadgeProps = {
  augmentId: number;
  augmentName: string;
};

export function AugmentBadge({ augmentId, augmentName }: AugmentBadgeProps) {
  const [hasError, setHasError] = useState(false);
  
  const augmentPath = (augmentMap as Record<string, string>)[augmentId.toString()];
  
  const cleanPath = augmentPath 
    ? augmentPath.replace("/lol-game-data/assets/ASSETS/", "assets/").toLowerCase()
    : null;
    
  const iconPath = cleanPath 
    ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/${cleanPath}` 
    : null;

  if (hasError || !iconPath) {
    return (
      <span 
        className="inline-flex h-full w-full items-center justify-center rounded bg-stone-800 text-[9px] text-gold font-bold border border-gold/20"
        title={augmentName}
      >
        {augmentId}
      </span>
    );
  }

  return (
    <Image 
      src={iconPath} 
      alt={augmentName} 
      width={32}
      height={32}
      className="h-full w-full rounded-full border border-gold/30 bg-black/40"
      onError={() => setHasError(true)}
      title={augmentName}
    />
  );
}
