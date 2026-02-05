import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  // Extract SteamID64 from claimed_id
  const claimedId = searchParams.get("openid.claimed_id");
  if (!claimedId) {
    return NextResponse.redirect(new URL("/?error=no_claimed_id", baseUrl));
  }

  // Match both /id/ and /profiles/ patterns
  const steamIdMatch = claimedId.match(/\/openid\/id\/(\d+)$/);
  if (!steamIdMatch) {
    return NextResponse.redirect(new URL("/?error=invalid_claimed_id", baseUrl));
  }

  const steamId = steamIdMatch[1];

  // Verify the OpenID response with Steam
  const verifyParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    verifyParams.set(key, value);
  });
  verifyParams.set("openid.mode", "check_authentication");

  try {
    const verifyRes = await fetch("https://steamcommunity.com/openid/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: verifyParams.toString(),
    });

    const verifyText = await verifyRes.text();
    if (!verifyText.includes("is_valid:true")) {
      return NextResponse.redirect(new URL("/?error=verification_failed", baseUrl));
    }
  } catch {
    return NextResponse.redirect(new URL("/?error=verification_error", baseUrl));
  }

  // Redirect to our verify endpoint which creates the session
  const verifyUrl = new URL("/api/auth/steam/verify", baseUrl);
  verifyUrl.searchParams.set("steamId", steamId);

  return NextResponse.redirect(verifyUrl);
}
