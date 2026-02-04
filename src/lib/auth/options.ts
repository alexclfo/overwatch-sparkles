import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getPlayerSummaries } from "@/lib/steam/api";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "steam",
      name: "Steam",
      credentials: {
        steamId: { label: "Steam ID", type: "text" },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.steamId) return null;
        
        // Fetch player info from Steam
        const players = await getPlayerSummaries([credentials.steamId]);
        if (players.length === 0) return null;
        
        const player = players[0];
        return {
          id: player.steamid,
          name: player.personaname,
          image: player.avatarfull,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.steamId = user.id;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.steamId) {
        (session.user as { steamId?: string }).steamId = token.steamId as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        
        // Check if user is admin/moderator - dynamic import to avoid circular dependency
        try {
          const { supabaseAdmin } = await import("@/lib/supabase/server");
          const { data } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("steamid64", token.steamId)
            .single();
          
          (session.user as { role?: string }).role = data?.role || undefined;
        } catch {
          (session.user as { role?: string }).role = undefined;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
