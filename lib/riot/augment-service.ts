import augmentMap from "@/lib/riot/augment-map.json";

interface CDAugment {
    id: number;
    nameTRA: string;
    augmentSmallIconPath: string;
}

// Cache for dynamically fetched augments
let remoteAugmentCache: Record<string, { name: string; iconPath: string }> | null = null;

export async function getAugmentInfo(id: number) {
    const idStr = id.toString();
    
    // 1. Try local static map
    const localPath = (augmentMap as Record<string, string>)[idStr];
    if (localPath) {
        return { 
            path: localPath.replace("/lol-game-data/assets/ASSETS/", "assets/").toLowerCase(),
            name: "Unknown Augment" 
        };
    }

    // 2. Fetch from CD if missing
    if (!remoteAugmentCache) {
        try {
            const resp = await fetch("https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json");
            if (resp.ok) {
                const data: CDAugment[] = await resp.json();
                remoteAugmentCache = data.reduce((acc: Record<string, { name: string; iconPath: string }>, aug: CDAugment) => {
                    acc[aug.id.toString()] = { name: aug.nameTRA, iconPath: aug.augmentSmallIconPath };
                    return acc;
                }, {});
            }
        } catch (e) {
            console.error("Failed to fetch remote augments", e);
        }
    }

    if (remoteAugmentCache && remoteAugmentCache[idStr]) {
        const iconPath = remoteAugmentCache[idStr].iconPath;
        return { 
            path: iconPath ? iconPath.replace("/lol-game-data/assets/ASSETS/", "assets/").toLowerCase() : "",
            name: remoteAugmentCache[idStr].name
        };
    }

    return null;
}
