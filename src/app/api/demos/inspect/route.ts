import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getR2Client, R2_BUCKET } from "@/lib/r2/client";
import { GetObjectCommand } from "@aws-sdk/client-s3";

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

    // Call Railway worker for parsing
    const workerUrl = process.env.RAILWAY_WORKER_URL;
    const workerSecret = process.env.RAILWAY_WORKER_SECRET;

    if (!workerUrl) {
      return NextResponse.json({ error: "Worker not configured" }, { status: 500 });
    }

    const workerRes = await fetch(`${workerUrl}/parse`, {
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

    const demoInfo: DemoInfo = await workerRes.json();
    return NextResponse.json(demoInfo);
  } catch (error) {
    console.error("Demo inspect error:", error);
    return NextResponse.json(
      { error: "Failed to inspect demo" },
      { status: 500 }
    );
  }
}
