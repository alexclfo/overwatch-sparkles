import type { OAuthConfig } from "next-auth/providers/oauth";

interface SteamProfile {
  steamid: string;
  personaname: string;
  avatarfull: string;
  profileurl: string;
}

export function SteamProvider(): OAuthConfig<SteamProfile> {
  const realm = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const returnTo = `${realm}/api/auth/callback/steam`;

  return {
    id: "steam",
    name: "Steam",
    type: "oauth",
    authorization: {
      url: "https://steamcommunity.com/openid/login",
      params: {
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "checkid_setup",
        "openid.return_to": returnTo,
        "openid.realm": realm,
        "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
      },
    },
    token: {
      url: "https://steamcommunity.com/openid/login",
      async request({ params }) {
        // Steam OpenID doesn't use OAuth tokens
        // The verification happens in the callback
        return { tokens: { access_token: "steam" } };
      },
    },
    userinfo: {
      url: "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
      async request({ tokens, provider }) {
        // User info is fetched separately via Steam Web API
        return {};
      },
    },
    async profile(profile) {
      return {
        id: profile.steamid,
        name: profile.personaname,
        image: profile.avatarfull,
      };
    },
  };
}
