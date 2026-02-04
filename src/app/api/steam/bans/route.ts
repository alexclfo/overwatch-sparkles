import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getPlayerBans } from "@/lib/steam/api";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const steamId = searchParams.get("steamid");

    if (!steamId) {
      return NextResponse.json({ error: "Missing steamid parameter" }, { status: 400 });
    }

    const bans = await getPlayerBans([steamId]);

    return NextResponse.json({ bans });
  } catch (error) {
    console.error("Steam bans API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
