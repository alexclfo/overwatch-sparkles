import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getR2Client, R2_BUCKET } from "@/lib/r2/client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";

interface DemoPlayer {
  name: string;
  steamId64: string;
  team: string | null;
}

interface DemoInfo {
  map: string | null;
  players: DemoPlayer[];
  serverName: string | null;
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { objectKey } = await request.json();
    if (!objectKey) {
      return NextResponse.json({ error: "Missing objectKey" }, { status: 400 });
    }

    // Download demo from R2
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: objectKey,
    });

    const response = await getR2Client().send(command);
    const buffer = await response.Body?.transformToByteArray();

    if (!buffer) {
      return NextResponse.json({ error: "Failed to read demo" }, { status: 500 });
    }

    // Write to temp file (parser needs file path)
    tempDir = mkdtempSync(join(tmpdir(), "demo-"));
    const tempFile = join(tempDir, "demo.dem");
    writeFileSync(tempFile, Buffer.from(buffer));

    // Parse demo using external script (avoids Turbopack bundling issues with native modules)
    const demoInfo = parseCS2Demo(tempFile);

    return NextResponse.json(demoInfo);
  } catch (error) {
    console.error("Demo inspect error:", error);
    return NextResponse.json(
      { error: "Failed to inspect demo" },
      { status: 500 }
    );
  } finally {
    // Clean up temp directory
    if (tempDir) {
      try {
        const tempFile = join(tempDir, "demo.dem");
        unlinkSync(tempFile);
        rmdirSync(tempDir);
      } catch {}
    }
  }
}

function parseCS2Demo(filePath: string): DemoInfo {
  const result: DemoInfo = {
    map: null,
    players: [],
    serverName: null,
  };

  try {
    // Run the parser script as a child process
    const scriptPath = join(process.cwd(), "scripts", "parse-demo.js");
    const output = execSync(`node "${scriptPath}" "${filePath}"`, {
      encoding: "utf-8",
      timeout: 60000, // 60 second timeout
    });

    const parsed = JSON.parse(output.trim());
    if (parsed.error) {
      console.error("Demo parse error:", parsed.error);
      return result;
    }

    return {
      map: parsed.map || null,
      players: parsed.players || [],
      serverName: parsed.serverName || null,
    };
  } catch (err) {
    console.error("CS2 demo parse error:", err);
  }

  return result;
}
