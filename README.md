# Sparkles Overwatch Portal

A web portal for submitting CS2 demos of suspected cheaters for community review as part of Sparkles' Overwatch series.

## Features

- **Steam Authentication** - Sign in with Steam to submit demos
- **Demo Upload** - Upload demos directly to Cloudflare R2 (500MB limit)
- **Per-User Quota** - 3 active submissions per user
- **Admin Queue** - Review submissions, mark verdicts, add notes
- **Inventory Value** - Auto-fetch suspect's CS2 inventory value

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Cloudflare R2
- **Auth**: Steam OpenID + NextAuth.js
- **Deploy**: Vercel

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-repo/overwatch-sparkles.git
cd overwatch-sparkles
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for dev)
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `STEAM_WEB_API_KEY` - Steam Web API key
- `R2_ENDPOINT` - Cloudflare R2 endpoint
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `R2_BUCKET` - R2 bucket name

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Schema

The app uses two main tables in Supabase:

- **submissions** - Demo submissions with metadata, status, verdict, inventory value
- **user_roles** - Admin/moderator allowlist by SteamID64

## Admin Access

Add SteamID64s to the `user_roles` table:

```sql
INSERT INTO user_roles (steamid64, role) VALUES ('76561197960266237', 'sparkles');
INSERT INTO user_roles (steamid64, role) VALUES ('76561198129412601', 'moderator');
```

## Deploy

Deploy to Vercel:

```bash
vercel
```

Set environment variables in Vercel dashboard.
