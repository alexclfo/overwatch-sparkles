import { NextRequest, NextResponse } from "next/server";
import { getFaceitPlayer } from "@/lib/faceit/client";

export async function GET(request: NextRequest) {
  const steamId = request.nextUrl.searchParams.get("steamId");

  if (!steamId) {
    return NextResponse.json({ error: "Missing steamId parameter" }, { status: 400 });
  }

  const result = await getFaceitPlayer(steamId);

  return NextResponse.json(result);
}
