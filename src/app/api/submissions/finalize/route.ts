import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveSteamProfileUrl, getPlayerSummaries } from "@/lib/steam/api";
import { fetchInventoryValue } from "@/lib/steam/inventory";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      submissionId,
      objectKey,
      filename,
      size,
      contentType,
      source,
      map,
      match_rank_or_elo,
      suspected_steamid64: providedSteamId64,
      suspected_profile_url,
      spectate_player,
      start_tick_or_round,
      suspicion_reason,
    } = body;

    if (!submissionId || !objectKey) {
      return NextResponse.json(
        { error: "Missing submissionId or objectKey" },
        { status: 400 }
      );
    }

    // Resolve suspect SteamID64 (from demo extraction or manual URL)
    let suspected_steamid64: string | null = providedSteamId64 || null;
    let suspected_persona_name: string | null = null;
    let suspected_avatar_url: string | null = null;

    if (!suspected_steamid64 && suspected_profile_url) {
      suspected_steamid64 = await resolveSteamProfileUrl(suspected_profile_url);
    }

    if (suspected_steamid64) {
      const players = await getPlayerSummaries([suspected_steamid64]);
      if (players.length > 0) {
        suspected_persona_name = players[0].personaname;
        suspected_avatar_url = players[0].avatarfull;
      }
    }

    // INSERT new submission (not update - presign no longer creates rows)
    const { error: insertError } = await supabaseAdmin
      .from("submissions")
      .insert({
        id: submissionId,
        submitter_steamid64: session.user.steamId,
        submitter_persona_name: session.user.name,
        submitter_avatar_url: session.user.image || null,
        demo_object_key: objectKey,
        demo_original_filename: filename,
        demo_size_bytes: size,
        demo_mime: contentType || "application/octet-stream",
        source: source || "cs2",
        map,
        match_rank_or_elo,
        suspected_profile_url: suspected_profile_url || null,
        suspected_steamid64,
        suspected_persona_name,
        suspected_avatar_url,
        spectate_player,
        start_tick_or_round: start_tick_or_round || null,
        suspicion_reason,
        status: "new",
        worker_status: "queued",
        submitted_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Error creating submission:", insertError);
      return NextResponse.json(
        { error: "Failed to create submission" },
        { status: 500 }
      );
    }

    // Remove from pending_uploads since submission is now finalized
    await supabaseAdmin
      .from("pending_uploads")
      .delete()
      .eq("r2_key", objectKey);

    // Fetch inventory value in background (no worker yet)
    if (suspected_steamid64) {
      fetchAndUpdateInventory(submissionId, suspected_steamid64).catch((err) => {
        console.error("Failed to fetch inventory:", err);
      });
    }

    return NextResponse.json({ success: true, submissionId });
  } catch (error) {
    console.error("Finalize error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function fetchAndUpdateInventory(submissionId: string, steamId64: string) {
  try {
    const result = await fetchInventoryValue(steamId64);
    
    await supabaseAdmin
      .from("submissions")
      .update({
        inventory_value_cents: result.value_cents,
        inventory_value_currency: result.currency,
        inventory_value_updated_at: new Date().toISOString(),
        inventory_value_error: result.error || null,
        worker_status: "complete",
      })
      .eq("id", submissionId);
  } catch (error) {
    console.error("Inventory update failed:", error);
    await supabaseAdmin
      .from("submissions")
      .update({
        inventory_value_error: "Failed to fetch inventory",
        worker_status: "failed",
      })
      .eq("id", submissionId);
  }
}

async function triggerWorker(submissionId: string) {
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  const workerSecret = process.env.RAILWAY_WORKER_SECRET;

  if (!workerUrl) {
    console.log("RAILWAY_WORKER_URL not configured, skipping worker trigger");
    return;
  }

  try {
    await fetch(`${workerUrl}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(workerSecret && { Authorization: `Bearer ${workerSecret}` }),
      },
      body: JSON.stringify({ submissionId }),
    });
  } catch (error) {
    console.error("Worker trigger failed:", error);
  }
}
