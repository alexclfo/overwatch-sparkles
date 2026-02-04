import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, R2_BUCKET } from "@/lib/r2/client";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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

    // Get submission
    const { data: submission, error } = await supabaseAdmin
      .from("submissions")
      .select("demo_object_key, demo_original_filename")
      .eq("id", id)
      .single();

    if (error || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (!submission.demo_object_key) {
      return NextResponse.json({ error: "No demo file" }, { status: 400 });
    }

    // Download demo file to temp
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `demo-${id}.dem`);

    try {
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: submission.demo_object_key,
      });

      const response = await getR2Client().send(command);
      const bodyBytes = await response.Body?.transformToByteArray();

      if (!bodyBytes) {
        return NextResponse.json({ error: "Failed to download demo" }, { status: 500 });
      }

      fs.writeFileSync(tempFile, Buffer.from(bodyBytes));

      // Run parser script
      const scriptPath = path.join(process.cwd(), "scripts", "parse-demo-stats.js");
      const output = execSync(`node "${scriptPath}" "${tempFile}"`, {
        encoding: "utf-8",
        timeout: 60000, // 60 second timeout
      });

      const stats = JSON.parse(output);

      // Cleanup temp file
      fs.unlinkSync(tempFile);

      return NextResponse.json({ stats });
    } catch (parseError: any) {
      // Cleanup temp file on error
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }

      console.error("Demo parse error:", parseError);
      return NextResponse.json(
        { error: parseError.message || "Failed to parse demo" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
