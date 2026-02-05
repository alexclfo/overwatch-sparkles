import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getR2Client, R2_BUCKET, MAX_FILE_SIZE } from "@/lib/r2/client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const MAX_ACTIVE_SUBMISSIONS = 3;
const COOLDOWN_SECONDS = 20;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename, contentType, size } = await request.json();

    if (!filename || !size) {
      return NextResponse.json(
        { error: "Missing filename or size" },
        { status: 400 }
      );
    }

    if (size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    // Check if user is admin/moderator - they bypass rate limits
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("steamid64", session.user.steamId)
      .single();

    const isAdminOrMod = roleData?.role === "sparkles" || roleData?.role === "moderator";

    // Skip rate limiting for admins/moderators
    if (!isAdminOrMod) {
      // Check cooldown - last submission must be at least 20 seconds ago
      const cooldownTime = new Date(Date.now() - COOLDOWN_SECONDS * 1000).toISOString();
      const { data: recentSubmission } = await supabaseAdmin
        .from("submissions")
        .select("submitted_at")
        .eq("submitter_steamid64", session.user.steamId)
        .gt("submitted_at", cooldownTime)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .single();

      if (recentSubmission) {
        const lastSubmitTime = new Date(recentSubmission.submitted_at).getTime();
        const waitSeconds = Math.ceil((lastSubmitTime + COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
        return NextResponse.json(
          {
            error: `Easy there, detective! 🕵️ Please wait ${waitSeconds} seconds before submitting another report.`,
            cooldown: true,
            waitSeconds,
          },
          { status: 429 }
        );
      }

      // Check per-user quota (only count finalized submissions)
      const { count, error: countError } = await supabaseAdmin
        .from("submissions")
        .select("*", { count: "exact", head: true })
        .eq("submitter_steamid64", session.user.steamId)
        .in("status", ["new"])
        .not("submitted_at", "is", null);

      if (countError) {
        console.error("Error checking quota:", countError);
        return NextResponse.json(
          { error: "Failed to check submission quota" },
          { status: 500 }
        );
      }

      if ((count || 0) >= MAX_ACTIVE_SUBMISSIONS) {
        return NextResponse.json(
          {
            error: `You've hit the limit! 📋 You have ${MAX_ACTIVE_SUBMISSIONS} active submissions pending review. Hang tight while we process them.`,
            quota: true,
            activeCount: count,
          },
          { status: 429 }
        );
      }
    }

    // Generate submission ID and object key (NO DB insert here - done in finalize)
    const submissionId = uuidv4();
    const ext = filename.split(".").pop() || "dem";
    const objectKey = `demos/${submissionId}.${ext}`;

    // Generate presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: objectKey,
      ContentType: contentType || "application/octet-stream",
      ContentLength: size,
    });

    const uploadUrl = await getSignedUrl(getR2Client(), command, {
      expiresIn: 3600, // 1 hour
    });

    // Track pending upload for cleanup of orphaned files
    await supabaseAdmin.from("pending_uploads").insert({
      r2_key: objectKey,
      submitter_steamid64: session.user.steamId,
      original_filename: filename,
      file_size_bytes: size,
    });

    return NextResponse.json({
      uploadUrl,
      objectKey,
      submissionId,
      steamId: session.user.steamId,
      personaName: session.user.name,
    });
  } catch (error) {
    console.error("Presign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
