import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getR2Client, R2_BUCKET } from "@/lib/r2/client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

// Process R2 cleanup queue - deletes files that were orphaned
// Called by Vercel cron or manually
export async function GET() {
  try {
    // Get queued R2 keys for deletion
    const { data: queuedItems, error: fetchError } = await supabaseAdmin
      .from("r2_cleanup_queue")
      .select("id, r2_key")
      .limit(50);

    if (fetchError) {
      console.error("Failed to fetch cleanup queue:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!queuedItems || queuedItems.length === 0) {
      return NextResponse.json({ message: "No files to clean up", deleted: 0 });
    }

    console.log(`Processing ${queuedItems.length} R2 files for deletion`);

    const r2 = getR2Client();
    let deleted = 0;
    let failed = 0;

    for (const item of queuedItems) {
      try {
        // Delete from R2
        await r2.send(new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: item.r2_key,
        }));

        // Remove from queue
        await supabaseAdmin
          .from("r2_cleanup_queue")
          .delete()
          .eq("id", item.id);

        console.log(`Deleted R2 file: ${item.r2_key}`);
        deleted++;
      } catch (error) {
        console.error(`Failed to delete ${item.r2_key}:`, error);
        failed++;
      }
    }

    // Check if more items remain
    const { count } = await supabaseAdmin
      .from("r2_cleanup_queue")
      .select("*", { count: "exact", head: true });

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
