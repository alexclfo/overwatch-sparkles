import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import { getPlayerSummaries } from "@/lib/steam/api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const steamId = searchParams.get("steamId");
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (!steamId) {
    return NextResponse.redirect(new URL("/?error=no_steam_id", baseUrl));
  }

  // Fetch player info from Steam
  const players = await getPlayerSummaries([steamId]);
  if (players.length === 0) {
    return NextResponse.redirect(new URL("/?error=player_not_found", baseUrl));
  }

  const player = players[0];

  // Create JWT token
  const token = await encode({
    token: {
      steamId: player.steamid,
      name: player.personaname,
      picture: player.avatarfull,
      sub: player.steamid,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  // Set the session cookie
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  const cookieName = isProduction
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return NextResponse.redirect(new URL("/", baseUrl));
}
