import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, R2_BUCKET } from "@/lib/r2/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("steamid64", session.user.steamId)
      .single();

    if (!roleData || !["sparkles", "moderator"].includes(roleData.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Get submission (including cached stats)
    const { data: submission, error } = await supabaseAdmin
      .from("submissions")
      .select("demo_object_key, demo_original_filename, match_stats")
      .eq("id", id)
      .single();

    if (error || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (!submission.demo_object_key) {
      return NextResponse.json({ error: "No demo file" }, { status: 400 });
    }

    // Return cached stats if available
    if (submission.match_stats) {
      return NextResponse.json({ stats: submission.match_stats, cached: true });
    }

    // Download demo from R2
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: submission.demo_object_key,
    });

    const response = await getR2Client().send(command);
    const buffer = await response.Body?.transformToByteArray();

    if (!buffer) {
      return NextResponse.json({ error: "Failed to download demo" }, { status: 500 });
    }

    // Call Railway worker for stats parsing
    const workerUrl = process.env.RAILWAY_WORKER_URL;
    const workerSecret = process.env.RAILWAY_WORKER_SECRET;

    if (!workerUrl) {
      return NextResponse.json({ error: "Worker not configured" }, { status: 500 });
    }

    const workerRes = await fetch(`${workerUrl}/stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(workerSecret && { Authorization: `Bearer ${workerSecret}` }),
      },
      body: JSON.stringify({
        demoBuffer: Buffer.from(buffer).toString("base64"),
      }),
    });

    if (!workerRes.ok) {
      const errorText = await workerRes.text();
      console.error("Worker error:", errorText);
      return NextResponse.json({ error: "Demo parse failed" }, { status: 500 });
    }

    const stats = await workerRes.json();

    // Cache stats in database (fire and forget)
    supabaseAdmin
      .from("submissions")
      .update({ match_stats: stats })
      .eq("id", id)
      .then(({ error: cacheError }) => {
        if (cacheError) console.error("Failed to cache stats:", cacheError);
      });

    return NextResponse.json({ stats, cached: false });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
