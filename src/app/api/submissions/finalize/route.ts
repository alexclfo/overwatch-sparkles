import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveSteamProfileUrl, getPlayerSummaries } from "@/lib/steam/api";
import { finalizeSubmissionSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate request body with Zod
    const parseResult = finalizeSubmissionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: `Validation failed: ${parseResult.error.message}` },
        { status: 400 }
      );
    }

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
      must_check_rounds,
      suspicion_reason,
    } = parseResult.data;

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

    // Build insert data - must_check_rounds may not exist in DB yet
    const insertData: Record<string, unknown> = {
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
      suspicion_reason,
      status: "new",
      worker_status: "queued",
      submitted_at: new Date().toISOString(),
    };

    // Include must_check_rounds if provided (column now exists)
    if (must_check_rounds?.length) {
      insertData.must_check_rounds = must_check_rounds;
    }

    // INSERT new submission
    const { error: insertError } = await supabaseAdmin
      .from("submissions")
      .insert(insertData);

    if (insertError) {
      console.error("Error creating submission:", insertError.message, insertError.details, insertError.hint);
      return NextResponse.json(
        { error: `Failed to create submission: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Remove from pending_uploads since submission is now finalized
    await supabaseAdmin
      .from("pending_uploads")
      .delete()
      .eq("r2_key", objectKey);

    // Queue inventory job for background processing
    if (suspected_steamid64) {
      await supabaseAdmin.from("inventory_jobs").insert({
        steamid64: suspected_steamid64,
        submission_id: submissionId,
        status: "pending",
        priority: 0,
      });
      
      // Trigger queue processor (fire and forget)
      triggerInventoryQueue().catch(console.error);
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

// Trigger the inventory queue processor Edge Function
async function triggerInventoryQueue() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) return;
  
  try {
    await fetch(`${supabaseUrl}/functions/v1/process-inventory-queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({}),
    });
  } catch (error) {
    console.error("Failed to trigger inventory queue:", error);
  }
}

