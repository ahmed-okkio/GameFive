import augmentMapRaw from "@/lib/riot/augment-map-raw.json";

export const AUGMENT_NAME_MAP: Record<number, string> = {};

for (const augment of augmentMapRaw) {
    AUGMENT_NAME_MAP[augment.id] = augment.nameTRA;
}
