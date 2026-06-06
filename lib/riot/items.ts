import itemData from "@/lib/riot/item.json";

interface ItemData {
  data: Record<string, { name: string }>;
}

export const ITEM_NAME_MAP: Record<number, string> = {};

const typedItemData = itemData as unknown as ItemData;

if (typedItemData && typedItemData.data) {
  const items = typedItemData.data;
  for (const itemId in items) {
    ITEM_NAME_MAP[parseInt(itemId)] = items[itemId].name;
  }
}
