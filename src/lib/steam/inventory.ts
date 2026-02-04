export interface InventoryResult {
  value_cents: number | null;
  currency: string | null;
  error: string | null;
  item_count?: number;
}

export async function fetchInventoryValue(steamId64: string): Promise<InventoryResult> {
  try {
    const inventoryUrl = `https://steamcommunity.com/inventory/${steamId64}/730/2?l=english&count=5000`;
    
    console.log(`Fetching inventory for ${steamId64}`);
    
    const res = await fetch(inventoryUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (res.status === 403) {
      return { value_cents: null, currency: null, error: "Inventory is private" };
    }

    if (res.status === 429) {
      return { value_cents: null, currency: null, error: "Rate limited by Steam" };
    }

    if (!res.ok) {
      return { value_cents: null, currency: null, error: `Steam API error: ${res.status}` };
    }

    const data = await res.json();

    if (!data.assets || data.assets.length === 0) {
      return { value_cents: 0, currency: "USD", error: null, item_count: 0 };
    }

    // Build item list with market names
    const itemCounts = new Map<string, { name: string; count: number; marketable: boolean }>();
    const descMap = new Map<string, { name: string; marketable: boolean }>();

    for (const desc of data.descriptions || []) {
      const key = `${desc.classid}_${desc.instanceid}`;
      descMap.set(key, {
        name: desc.market_hash_name || desc.name,
        marketable: desc.marketable === 1,
      });
    }

    for (const asset of data.assets || []) {
      const key = `${asset.classid}_${asset.instanceid}`;
      const info = descMap.get(key);
      if (info && info.marketable && info.name) {
        const existing = itemCounts.get(info.name);
        if (existing) {
          existing.count += 1;
        } else {
          itemCounts.set(info.name, { name: info.name, count: 1, marketable: true });
        }
      }
    }

    // Price top 30 items to avoid rate limiting
    const marketableItems = Array.from(itemCounts.values())
      .filter(i => i.marketable)
      .slice(0, 30);

    let totalCents = 0;
    let pricedCount = 0;

    for (const item of marketableItems) {
      const price = await fetchItemPrice(item.name);
      if (price !== null) {
        totalCents += price * item.count;
        pricedCount++;
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    return { 
      value_cents: totalCents, 
      currency: "USD", 
      error: null,
      item_count: data.assets.length,
    };
  } catch (error) {
    console.error("Inventory fetch error:", error);
    return { value_cents: null, currency: null, error: `Error: ${error instanceof Error ? error.message : "Unknown"}` };
  }
}

async function fetchItemPrice(marketHashName: string): Promise<number | null> {
  try {
    const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`;
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.success) return null;
    
    const priceStr = data.lowest_price || data.median_price;
    if (!priceStr) return null;

    const match = priceStr.match(/([\d,.]+)/);
    if (match) {
      let numStr = match[1];
      if (numStr.includes(",") && numStr.indexOf(",") > numStr.lastIndexOf(".")) {
        numStr = numStr.replace(/\./g, "").replace(",", ".");
      } else {
        numStr = numStr.replace(",", "");
      }
      const value = parseFloat(numStr);
      if (!isNaN(value)) {
        return Math.round(value * 100);
      }
    }

    return null;
  } catch {
    return null;
  }
}
