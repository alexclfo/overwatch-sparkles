import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getR2Client, R2_BUCKET } from "@/lib/r2/client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET(
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

    const { data: submission, error } = await supabaseAdmin
      .from("submissions")
      .select("demo_object_key, demo_original_filename")
      .eq("id", id)
      .single();

    if (error || !submission || !submission.demo_object_key) {
      return NextResponse.json(
        { error: "Demo not found" },
        { status: 404 }
      );
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: submission.demo_object_key,
      ResponseContentDisposition: `attachment; filename="${submission.demo_original_filename || "demo.dem"}"`,
    });

    const downloadUrl = await getSignedUrl(getR2Client(), command, {
      expiresIn: 3600,
    });

    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
