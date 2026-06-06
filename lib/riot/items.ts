import itemData from "@/lib/riot/item.json";

// The DDragon item.json has a "data" property containing the map of ID -> { name: string }
export const ITEM_NAME_MAP: Record<number, string> = {};

if (itemData && (itemData as any).data) {
  const items = (itemData as any).data;
  for (const itemId in items) {
    ITEM_NAME_MAP[parseInt(itemId)] = items[itemId].name;
  }
}
