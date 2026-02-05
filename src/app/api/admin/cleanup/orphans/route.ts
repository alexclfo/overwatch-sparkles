import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getR2Client, R2_BUCKET } from "@/lib/r2/client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

const ORPHAN_THRESHOLD_HOURS = 1;

export async function POST(request: NextRequest) {
  // Verify internal call via secret header (from Edge Function)
  const authHeader = request.headers.get("x-cleanup-secret");
  const expectedSecret = process.env.CLEANUP_SECRET;
  
  if (!expectedSecret || authHeader !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find pending uploads older than threshold
    const cutoffTime = new Date(Date.now() - ORPHAN_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString();
    
    const { data: orphanedUploads, error: fetchError } = await supabaseAdmin
      .from("pending_uploads")
      .select("id, r2_key, submitter_steamid64, created_at")
      .lt("created_at", cutoffTime)
      .limit(50);

    if (fetchError) {
      console.error("Failed to fetch orphaned uploads:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!orphanedUploads || orphanedUploads.length === 0) {
      return NextResponse.json({ message: "No orphaned uploads to clean up", deleted: 0 });
    }

    console.log(`Found ${orphanedUploads.length} orphaned uploads to clean up`);

    const r2 = getR2Client();
    let deleted = 0;
    let failed = 0;

    for (const upload of orphanedUploads) {
      try {
        // Delete from R2
        await r2.send(new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: upload.r2_key,
        }));

        // Delete from pending_uploads table
        await supabaseAdmin
          .from("pending_uploads")
          .delete()
          .eq("id", upload.id);

        console.log(`Deleted orphaned upload: ${upload.r2_key} (user: ${upload.submitter_steamid64})`);
        deleted++;
      } catch (error) {
        console.error(`Failed to delete ${upload.r2_key}:`, error);
        failed++;
      }
    }

    // Check if more orphans remain
    const { count } = await supabaseAdmin
      .from("pending_uploads")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffTime);

    return NextResponse.json({
      deleted,
      failed,
      remaining: count || 0,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
