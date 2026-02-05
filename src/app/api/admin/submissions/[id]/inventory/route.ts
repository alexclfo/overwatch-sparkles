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
    const { async: useAsync } = await request.json().catch(() => ({}));

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

    const steamId64 = submission.suspected_steamid64;

    // Use Supabase Edge Function for async processing
    if (useAsync) {
      // Invoke Edge Function (fire and forget)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseUrl && supabaseKey) {
        fetch(`${supabaseUrl}/functions/v1/process-inventory`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ steamid64: steamId64 }),
        }).catch(console.error); // Fire and forget
        
        return NextResponse.json({
          success: true,
          async: true,
          message: "Inventory processing started in background",
        });
      }
    }

    // Sync fallback: use local processing
    const { fetchInventoryValueWithTopItems } = await import("@/lib/steam/inventory");
    const result = await fetchInventoryValueWithTopItems(steamId64, true);

    // Update submission with value AND top items
    const { error: updateError } = await supabaseAdmin
      .from("submissions")
      .update({
        inventory_value_cents: result.value_cents,
        inventory_value_currency: result.currency,
        inventory_value_updated_at: new Date().toISOString(),
        inventory_value_error: result.error || null,
        inventory_top_items: result.top_items.length > 0 ? result.top_items : null,
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
