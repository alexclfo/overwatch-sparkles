import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      steamId?: string;
      role?: "sparkles" | "moderator" | null;
    };
  }

  interface User {
    id: string;
    name?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    steamId?: string;
  }
}
