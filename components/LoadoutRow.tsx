"use client";
import { useState } from "react";
import Image from "next/image";
import { getItemIconUrl, getSpellIconUrl, DEFAULT_DDRAGON_VERSION } from "@/lib/riot/ddragon";
import { AugmentBadge } from "@/components/AugmentBadge";
import { SPELL_MAP, SPELL_DISPLAY_NAME } from "@/lib/riot/spells";
import { AUGMENT_NAME_MAP } from "@/lib/riot/augments";
import { ITEM_NAME_MAP } from "@/lib/riot/items";

type LoadoutRowProps = {
    items: number[];
    spell1Id: number | null;
    spell2Id: number | null;
    augments: number[];
    version: string | null;
    size?: "sm" | "md";
};

export function LoadoutRow({ items, spell1Id, spell2Id, augments, version, size = "md" }: LoadoutRowProps) {
    const activeVersion = version ?? DEFAULT_DDRAGON_VERSION;
    
    // Increased sizes: 'md' (main) and 'sm' (expanded/small)
    const iconSize = size === "sm" ? "w-6 h-6" : "w-9 h-9";
    const spellSize = size === "sm" ? "w-4 h-4" : "w-6 h-6";
    const augmentSize = size === "sm" ? "w-4 h-4" : "w-8 h-8";
    
    const gapSize = size === "sm" ? "gap-2" : "gap-6";
    const marginSize = size === "sm" ? "ml-1" : "ml-4";

    const activeItems = items.filter(id => id !== 0);
    const paddedItems = [...activeItems, ...Array(7 - activeItems.length).fill(0)];

    return (
        <div className={`flex items-center ${gapSize}`}>
            <div className="flex items-center gap-1.5">
                <div className="flex flex-col gap-0.5 shrink-0">
                    {[spell1Id, spell2Id].map((id, i) => id ? (
                        <SpellIcon key={i} id={id} version={activeVersion} className={spellSize} />
                    ) : null)}
                </div>
                
                <div className="flex shrink-0 gap-0.5">
                    {paddedItems.map((itemId, i) => (
                        <ItemIcon key={i} id={itemId} version={activeVersion} className={iconSize} />
                    ))}
                </div>
            </div>

            {augments.length > 0 && (
                <div className={`grid grid-cols-3 gap-1 shrink-0 ${marginSize}`}>
                    {augments.map((augId, i) => (
                        <div key={i} className={augmentSize}>
                            <AugmentBadge augmentId={augId} augmentName={AUGMENT_NAME_MAP[augId] ?? `Augment ${augId}`} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function SpellIcon({ id, version, className }: { id: number | null, version: string, className: string }) {
    const [hasError, setHasError] = useState(false);
    if (!id) return <div className={`${className} bg-stone-900/50 rounded-sm border border-white/5`} />;
    
    const internalName = SPELL_MAP[id] ?? "SummonerSpell";
    const displayName = SPELL_DISPLAY_NAME[internalName] ?? internalName;
    const url = getSpellIconUrl(internalName, version);

    if (hasError) return <div className={`${className} bg-stone-800 rounded-sm border border-white/5`} title={displayName} />;

    return (
        <Image 
            src={url} 
            alt="Spell" 
            width={128}
            height={128}
            className={`${className} rounded-sm border border-white/5`} 
            onError={() => setHasError(true)}
            title={displayName}
        />
    );
}
function ItemIcon({ id, version, className }: { id: number, version: string, className: string }) {
    const [hasError, setHasError] = useState(false);
    const itemName = ITEM_NAME_MAP[id] ?? `Item ${id}`;

    if (id === 0) {
        return <div className={`${className} bg-stone-900/50 rounded-sm border border-white/5`} />;
    }

    if (!hasError) {
        return (
            <Image 
                src={getItemIconUrl(id, version)} 
                alt="Item" 
                width={128}
                height={128}
                className={`${className} rounded-sm border border-white/10 bg-black/20`}
                onError={() => setHasError(true)}
                title={itemName}
            />
        );
    }

    return <div className={`${className} bg-stone-900/50 rounded-sm border border-white/5`} title={itemName} />;
}
