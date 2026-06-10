"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getAugmentInfo } from "@/lib/riot/augment-service";

type AugmentBadgeProps = {
  augmentId: number;
  augmentName: string;
};

export function AugmentBadge({ augmentId, augmentName }: AugmentBadgeProps) {
  const [hasError, setHasError] = useState(false);
  const [info, setInfo] = useState<{ path: string, name: string } | null>(null);

  useEffect(() => {
    getAugmentInfo(augmentId).then(setInfo);
  }, [augmentId]);

  const iconPath = info 
    ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/${info.path}` 
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
      alt={info?.name || augmentName} 
      width={32}
      height={32}
      className="h-full w-full rounded-full border border-gold/30 bg-black/40"
      onError={() => setHasError(true)}
      title={info?.name || augmentName}
    />
  );
}
