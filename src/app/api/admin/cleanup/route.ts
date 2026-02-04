import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, R2_BUCKET } from "@/lib/r2/client";

export async function POST(request: NextRequest) {
  try {
    // Check for admin or cron secret
    const cronSecret = request.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      // Cron job access - proceed
    } else {
      // Check for admin session
      const session = await getServerSession(authOptions);
      if (!session?.user?.steamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("steamid64", session.user.steamId)
        .single();

      if (!roleData || roleData.role !== "sparkles") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Find expired pending uploads
    const { data: expired, error: selectError } = await supabaseAdmin
      .from("pending_uploads")
      .select("id, r2_key")
      .lt("expires_at", new Date().toISOString());

    if (selectError) {
      console.error("Error fetching expired uploads:", selectError);
      return NextResponse.json(
        { error: "Failed to fetch expired uploads" },
        { status: 500 }
      );
    }

    if (!expired || expired.length === 0) {
      return NextResponse.json({ deleted: 0, message: "No orphaned files found" });
    }

    const r2 = getR2Client();
    let deletedCount = 0;
    const errors: string[] = [];

    for (const upload of expired) {
      try {
        // Delete from R2
        await r2.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: upload.r2_key,
          })
        );

        // Delete from pending_uploads table
        await supabaseAdmin
          .from("pending_uploads")
          .delete()
          .eq("id", upload.id);

        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete ${upload.r2_key}:`, err);
        errors.push(upload.r2_key);
      }
    }

    return NextResponse.json({
      deleted: deletedCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
