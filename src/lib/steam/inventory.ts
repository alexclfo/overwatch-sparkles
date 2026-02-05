import { createClient } from "@supabase/supabase-js";

export interface TopItem {
  name: string;
  price_cents: number;
  icon_url: string;
}

export interface InventoryResult {
  value_cents: number | null;
  currency: string | null;
  error: string | null;
  item_count?: number;
}

export interface InventoryResultWithTopItems extends InventoryResult {
  top_items: TopItem[];
}

// ============ DATABASE CACHE ============

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const DB_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const INVENTORY_CACHE_TTL = 60 * 60 * 1000; // 1 hour for inventory cache

// ============ SUSPECT INVENTORY CACHE ============

interface CachedInventory {
  value_cents: number | null;
  currency: string | null;
  item_count: number | null;
  top_items: TopItem[] | null;
  error: string | null;
  updated_at: string;
}

// Get cached inventory for a suspect
async function getCachedInventory(steamId64: string): Promise<CachedInventory | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data } = await supabase
      .from("suspect_inventories")
      .select("*")
      .eq("steamid64", steamId64)
      .single();

    if (data) {
      const age = Date.now() - new Date(data.updated_at).getTime();
      if (age < INVENTORY_CACHE_TTL) {
        return {
          value_cents: data.value_cents,
          currency: data.currency,
          item_count: data.item_count,
          top_items: data.top_items,
          error: data.error,
          updated_at: data.updated_at,
        };
      }
    }
  } catch {
    // Table might not exist or no data
  }

  return null;
}

// Save inventory for a suspect
async function saveInventoryToCache(
  steamId64: string,
  result: InventoryResultWithTopItems
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase
      .from("suspect_inventories")
      .upsert({
        steamid64: steamId64,
        value_cents: result.value_cents,
        currency: result.currency,
        item_count: result.item_count,
        top_items: result.top_items,
        error: result.error,
        updated_at: new Date().toISOString(),
      }, { onConflict: "steamid64" });
  } catch {
    // Ignore errors
  }
}

// ============ PRICE CACHE ============

// Load cached prices from DB for a list of items (single batch query)
async function loadCachedPricesFromDB(names: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  const supabase = getSupabase();
  if (!supabase || names.length === 0) return priceMap;

  try {
    const cutoff = new Date(Date.now() - DB_CACHE_TTL).toISOString();
    const { data } = await supabase
      .from("item_price_cache")
      .select("market_hash_name, price_cents")
      .in("market_hash_name", names)
      .gt("updated_at", cutoff);

    if (data) {
      for (const row of data) {
        priceMap.set(row.market_hash_name, row.price_cents);
      }
    }
  } catch {
    // Table might not exist
  }

  return priceMap;
}

// Save prices to DB cache (batch upsert)
async function savePricesToDB(prices: Map<string, number>): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || prices.size === 0) return;

  try {
    const rows = Array.from(prices.entries()).map(([name, price]) => ({
      market_hash_name: name,
      price_cents: price,
      updated_at: new Date().toISOString(),
    }));

    // Batch upsert in chunks of 100
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      await supabase
        .from("item_price_cache")
        .upsert(chunk, { onConflict: "market_hash_name" });
    }
  } catch {
    // Ignore errors
  }
}

// ============ CS.TRADE BULK API ============

let bulkPriceCache: Map<string, number> | null = null;
let bulkPriceCacheTime = 0;
const BULK_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function fetchBulkPrices(): Promise<Map<string, number>> {
  if (bulkPriceCache && Date.now() - bulkPriceCacheTime < BULK_CACHE_TTL) {
    return bulkPriceCache;
  }

  console.log("Fetching bulk prices from cs.trade...");
  const priceMap = new Map<string, number>();

  try {
    const res = await fetch("https://cdn.cs.trade:2096/api/prices_CSGO", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (res.ok) {
      const data = await res.json();
      for (const [name, info] of Object.entries(data)) {
        const item = info as { price?: number };
        if (item.price && item.price > 0) {
          priceMap.set(name, Math.round(item.price * 100));
        }
      }
      console.log(`Loaded ${priceMap.size} prices from cs.trade`);
      bulkPriceCache = priceMap;
      bulkPriceCacheTime = Date.now();
    }
  } catch (error) {
    console.error("cs.trade API error:", error);
  }

  return priceMap;
}

// Fetch price from Steam Market (fallback for items not in cs.trade)
// Returns null on rate limit - caller should handle delays
async function fetchSteamPrice(marketHashName: string): Promise<number | "rate_limited" | null> {
  try {
    const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`;
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (res.status === 429) {
      return "rate_limited";
    }

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

// Price items: DB cache -> cs.trade bulk -> Steam Market fallback
async function fetchPricesForItems(
  items: { name: string; icon_url: string; count: number }[]
): Promise<{ name: string; price_cents: number; icon_url: string; count: number }[]> {
  const pricedItems: { name: string; price_cents: number; icon_url: string; count: number }[] = [];
  const newPricesToCache = new Map<string, number>();
  
  console.log(`Pricing ${items.length} unique items...`);
  const itemNames = items.map(i => i.name);
  
  // Step 1: Check DB cache first (batch query)
  const dbCached = await loadCachedPricesFromDB(itemNames);
  console.log(`DB cache: ${dbCached.size} items found`);
  
  // Step 2: Get bulk prices from cs.trade
  const bulkPrices = await fetchBulkPrices();
  
  // Step 3: Price items using cache -> bulk -> track misses
  const steamFallbackItems: typeof items = [];
  
  for (const item of items) {
    // Check DB cache first
    let price = dbCached.get(item.name);
    
    // Then check cs.trade bulk
    if (price === undefined) {
      price = bulkPrices.get(item.name);
      if (price !== undefined) {
        newPricesToCache.set(item.name, price); // Save to DB later
      }
    }
    
    if (price !== undefined) {
      pricedItems.push({
        name: item.name,
        price_cents: price,
        icon_url: item.icon_url,
        count: item.count,
      });
    } else {
      steamFallbackItems.push(item);
    }
  }
  
  console.log(`${pricedItems.length} priced (${dbCached.size} DB, ${pricedItems.length - dbCached.size} cs.trade), ${steamFallbackItems.length} need Steam`);
  
  // Step 4: Fetch from Steam Market with 3s delay (20 req/min limit)
  if (steamFallbackItems.length > 0) {
    const maxSteamRequests = 15; // Conservative limit per batch
    const toFetch = steamFallbackItems.slice(0, maxSteamRequests);
    console.log(`Fetching ${toFetch.length}/${steamFallbackItems.length} prices from Steam Market...`);
    
    let rateLimited = false;
    for (let i = 0; i < toFetch.length && !rateLimited; i++) {
      const item = toFetch[i];
      const price = await fetchSteamPrice(item.name);
      
      if (price === "rate_limited") {
        console.log(`Steam rate limited at item ${i + 1}, stopping batch`);
        rateLimited = true;
        break;
      }
      
      if (price !== null) {
        pricedItems.push({
          name: item.name,
          price_cents: price,
          icon_url: item.icon_url,
          count: item.count,
        });
        newPricesToCache.set(item.name, price);
      }
      
      // Fixed 3s delay between requests (Steam limit is ~20/min)
      if (i + 1 < toFetch.length) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    
    if (steamFallbackItems.length > maxSteamRequests) {
      console.log(`Skipped ${steamFallbackItems.length - maxSteamRequests} items (batch limit)`);
    }
  }
  
  // Step 5: Save new prices to DB cache (async, don't wait)
  if (newPricesToCache.size > 0) {
    savePricesToDB(newPricesToCache).catch(() => {});
    console.log(`Caching ${newPricesToCache.size} new prices to DB`);
  }
  
  return pricedItems;
}

// Fetch full inventory with pagination
async function fetchFullInventory(steamId64: string): Promise<{
  items: Map<string, { name: string; count: number; icon_url: string }>;
  totalCount: number;
  error: string | null;
}> {
  const descMap = new Map<string, { name: string; marketable: boolean; icon_url: string }>();
  const itemCounts = new Map<string, { name: string; count: number; icon_url: string }>();
  
  let lastAssetId: string | null = null;
  let totalFetched = 0;
  let pageCount = 0;
  const maxPages = 50; // Safety limit
  
  console.log(`Starting inventory fetch for ${steamId64}`);
  
  while (pageCount < maxPages) {
    pageCount++;
    
    // Use count=75 (Steam returns 400 for higher values)
    let inventoryUrl = `https://steamcommunity.com/inventory/${steamId64}/730/2?l=english&count=75`;
    if (lastAssetId) {
      inventoryUrl += `&start_assetid=${lastAssetId}`;
    }
    
    let res = await fetch(inventoryUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (res.status === 403) {
      return { items: itemCounts, totalCount: 0, error: "Inventory is private" };
    }

    if (res.status === 429) {
      return { items: itemCounts, totalCount: totalFetched, error: "Rate limited by Steam" };
    }

    // Retry on 400 errors
    if (res.status === 400) {
      console.log(`Got 400, retrying after delay...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      res = await fetch(inventoryUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
        cache: "no-store",
      });
      if (!res.ok) {
        return { items: itemCounts, totalCount: totalFetched, error: "Profile may be private or Steam unavailable" };
      }
    }

    if (!res.ok) {
      return { items: itemCounts, totalCount: totalFetched, error: `Steam API error: ${res.status}` };
    }

    const data = await res.json();
    
    if (!data.assets || data.assets.length === 0) {
      break;
    }

    const assetCount = data.assets.length;
    totalFetched += assetCount;
    console.log(`Page ${pageCount}: fetched ${assetCount} items (total: ${totalFetched})`);

    // Build description map
    for (const desc of data.descriptions || []) {
      const key = `${desc.classid}_${desc.instanceid}`;
      if (!descMap.has(key)) {
        descMap.set(key, {
          name: desc.market_hash_name || desc.name,
          marketable: desc.marketable === 1,
          icon_url: desc.icon_url || "",
        });
      }
    }

    // Count items
    for (const asset of data.assets) {
      const key = `${asset.classid}_${asset.instanceid}`;
      const info = descMap.get(key);
      if (info && info.marketable && info.name) {
        const existing = itemCounts.get(info.name);
        if (existing) {
          existing.count += 1;
        } else {
          itemCounts.set(info.name, { name: info.name, count: 1, icon_url: info.icon_url });
        }
      }
    }

    // Check for more pages
    if (!data.more_items || data.more_items !== 1 || !data.last_assetid) {
      console.log("No more pages");
      break;
    }
    
    lastAssetId = data.last_assetid;
    // Small delay between pages
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(`Inventory fetch complete: ${totalFetched} total items, ${itemCounts.size} unique marketable items`);
  return { items: itemCounts, totalCount: totalFetched, error: null };
}

// Main function: fetch inventory and calculate value
// Checks suspect_inventories cache first, then fetches fresh if needed
export async function fetchInventoryValueWithTopItems(
  steamId64: string,
  forceRefresh = false
): Promise<InventoryResultWithTopItems> {
  try {
    console.log(`=== Starting inventory valuation for ${steamId64} ===`);
    
    // Step 0: Check suspect inventory cache (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedInventory(steamId64);
      if (cached) {
        console.log(`Using cached inventory (age: ${Math.round((Date.now() - new Date(cached.updated_at).getTime()) / 60000)}min)`);
        return {
          value_cents: cached.value_cents,
          currency: cached.currency,
          error: cached.error,
          top_items: cached.top_items || [],
          item_count: cached.item_count || undefined,
        };
      }
    }
    
    // Step 1: Fetch full inventory with pagination
    const { items, totalCount, error } = await fetchFullInventory(steamId64);
    
    if (error && items.size === 0) {
      const result = { value_cents: null, currency: null, error, top_items: [] };
      await saveInventoryToCache(steamId64, result);
      return result;
    }

    if (items.size === 0) {
      const result = { value_cents: 0, currency: "USD", error: null, top_items: [], item_count: 0 };
      await saveInventoryToCache(steamId64, result);
      return result;
    }

    // Step 2: Convert map to array for pricing
    const itemsArray = Array.from(items.values());
    console.log(`Found ${itemsArray.length} unique marketable items`);

    // Step 3: Fetch prices (DB cache -> cs.trade -> Steam Market)
    const pricedItems = await fetchPricesForItems(itemsArray);

    // Step 4: Calculate total value
    let totalCents = 0;
    for (const item of pricedItems) {
      totalCents += item.price_cents * item.count;
    }

    console.log(`Priced ${pricedItems.length}/${itemsArray.length} items`);
    console.log(`Total value: $${(totalCents / 100).toFixed(2)}`);

    // Step 5: Get top 3 most valuable items (by unit price)
    pricedItems.sort((a, b) => b.price_cents - a.price_cents);
    const top_items: TopItem[] = pricedItems.slice(0, 3).map(i => ({
      name: i.name,
      price_cents: i.price_cents,
      icon_url: i.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${i.icon_url}` : "",
    }));

    const result: InventoryResultWithTopItems = { 
      value_cents: totalCents, 
      currency: "USD", 
      error: error,
      top_items,
      item_count: totalCount,
    };
    
    // Step 6: Save to suspect inventory cache
    await saveInventoryToCache(steamId64, result);
    
    return result;
  } catch (error) {
    console.error("Inventory valuation error:", error);
    return { 
      value_cents: null, 
      currency: null, 
      error: `Error: ${error instanceof Error ? error.message : "Unknown"}`, 
      top_items: [] 
    };
  }
}

// Legacy function for backwards compatibility
export async function fetchInventoryValue(steamId64: string): Promise<InventoryResult> {
  const result = await fetchInventoryValueWithTopItems(steamId64);
  return {
    value_cents: result.value_cents,
    currency: result.currency,
    error: result.error,
    item_count: result.item_count,
  };
}

// Get cached inventory for a suspect (for display, doesn't trigger refresh)
export async function getSuspectInventory(steamId64: string): Promise<InventoryResultWithTopItems | null> {
  const cached = await getCachedInventory(steamId64);
  if (!cached) return null;
  
  return {
    value_cents: cached.value_cents,
    currency: cached.currency,
    error: cached.error,
    top_items: cached.top_items || [],
    item_count: cached.item_count || undefined,
  };
}
