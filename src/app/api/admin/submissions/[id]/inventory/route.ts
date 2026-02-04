import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("steamid64", session.user.steamId)
      .single();

    if (!roleData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Get submission
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from("submissions")
      .select("suspected_steamid64")
      .eq("id", id)
      .single();

    if (fetchError || !submission || !submission.suspected_steamid64) {
      return NextResponse.json(
        { error: "Submission not found or no suspect SteamID" },
        { status: 404 }
      );
    }

    // Fetch inventory value
    const result = await fetchInventoryValue(submission.suspected_steamid64);

    // Update submission
    const { error: updateError } = await supabaseAdmin
      .from("submissions")
      .update({
        inventory_value_cents: result.value_cents,
        inventory_value_currency: result.currency,
        inventory_value_updated_at: new Date().toISOString(),
        inventory_value_error: result.error || null,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update inventory value:", updateError);
    }

    return NextResponse.json({
      success: true,
      value_cents: result.value_cents,
      currency: result.currency,
      error: result.error,
      top_items: result.top_items,
    });
  } catch (error) {
    console.error("Inventory refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface TopItem {
  name: string;
  price_cents: number;
  icon_url: string;
}

interface InventoryResult {
  value_cents: number | null;
  currency: string | null;
  error: string | null;
  top_items: TopItem[];
}

async function fetchInventoryValue(steamId64: string): Promise<InventoryResult> {
  try {
    console.log(`Fetching inventory for ${steamId64}`);
    
    // Build item list with market names and icons - paginate through all pages
    const descMap = new Map<string, { name: string; marketable: boolean; icon_url: string }>();
    const itemCounts = new Map<string, { name: string; count: number; marketable: boolean; icon_url: string }>();
    
    let lastAssetId: string | null = null;
    let totalFetched = 0;
    let pageCount = 0;
    const maxPages = 100; // Increased limit for large inventories
    
    while (pageCount < maxPages) {
      pageCount++;
      let inventoryUrl = `https://steamcommunity.com/inventory/${steamId64}/730/2?l=english&count=75`;
      if (lastAssetId) {
        inventoryUrl += `&start_assetid=${lastAssetId}`;
      }
      
      const res = await fetch(inventoryUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
        cache: "no-store",
      });

      if (res.status === 403) {
        return { value_cents: null, currency: null, error: "Inventory is private", top_items: [] };
      }

      if (res.status === 429) {
        return { value_cents: null, currency: null, error: "Rate limited by Steam", top_items: [] };
      }

      if (!res.ok) {
        const text = await res.text();
        console.error(`Inventory fetch failed: ${res.status}`, text.substring(0, 200));
        return { value_cents: null, currency: null, error: `Steam API error: ${res.status}`, top_items: [] };
      }

      const data = await res.json();
      const assetCount = data.assets?.length || 0;
      totalFetched += assetCount;
      console.log(`Page ${pageCount}: assets=${assetCount}, total_so_far=${totalFetched}, total_inventory=${data.total_inventory_count || 0}`);

      if (!data.assets || data.assets.length === 0) {
        break;
      }

      // Process descriptions
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

      // Process assets
      for (const asset of data.assets || []) {
        const key = `${asset.classid}_${asset.instanceid}`;
        const info = descMap.get(key);
        if (info && info.marketable && info.name) {
          const existing = itemCounts.get(info.name);
          if (existing) {
            existing.count += 1;
          } else {
            itemCounts.set(info.name, { name: info.name, count: 1, marketable: true, icon_url: info.icon_url });
          }
        }
      }

      // Check if there are more pages
      if (!data.more_items || !data.last_assetid) {
        break;
      }
      
      lastAssetId = data.last_assetid;
      // Small delay between pages to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`Fetched ${totalFetched} total assets across ${pageCount} pages`);

    if (itemCounts.size === 0) {
      return { value_cents: 0, currency: "USD", error: null, top_items: [] };
    }

    // Get marketable items
    const marketableItems = Array.from(itemCounts.values()).filter(i => i.marketable);
    
    // Price up to 20 items
    const itemsToPrice = marketableItems.slice(0, 20);
    console.log(`Fetching prices for ${itemsToPrice.length} unique items`);

    const pricedItems: { name: string; price_cents: number; icon_url: string; count: number }[] = [];
    let totalCents = 0;

    for (const item of itemsToPrice) {
      const price = await fetchItemPrice(item.name);
      if (price !== null) {
        totalCents += price * item.count;
        pricedItems.push({ name: item.name, price_cents: price, icon_url: item.icon_url, count: item.count });
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    // Sort by price and get top 3
    pricedItems.sort((a, b) => b.price_cents - a.price_cents);
    const top_items: TopItem[] = pricedItems.slice(0, 3).map(i => ({
      name: i.name,
      price_cents: i.price_cents,
      icon_url: `https://community.cloudflare.steamstatic.com/economy/image/${i.icon_url}`,
    }));

    console.log(`Priced ${pricedItems.length} items, total: $${(totalCents / 100).toFixed(2)}, top 3:`, top_items.map(i => i.name));

    return { 
      value_cents: totalCents, 
      currency: "USD", 
      error: null,
      top_items,
    };
  } catch (error) {
    console.error("Inventory fetch error:", error);
    return { value_cents: null, currency: null, error: `Error: ${error instanceof Error ? error.message : "Unknown"}`, top_items: [] };
  }
}

async function fetchItemPrice(marketHashName: string): Promise<number | null> {
  try {
    const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`;
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.log(`Price fetch failed for "${marketHashName}": ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data.success) return null;
    
    // Try lowest_price first, then median_price
    const priceStr = data.lowest_price || data.median_price;
    if (!priceStr) return null;

    // Parse price like "$1.23" or "1,23€" to cents
    const match = priceStr.match(/([\d,.]+)/);
    if (match) {
      // Handle both comma and period as decimal separator
      let numStr = match[1];
      // If format is like "1.234,56" (European), convert to "1234.56"
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
  } catch (err) {
    console.log(`Price fetch error for "${marketHashName}":`, err);
    return null;
  }
}
