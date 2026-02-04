import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { SubmissionStatus } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("steamid64", session.user.steamId)
      .single();

    if (!roleData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get("status") as SubmissionStatus | null;
    const verdictFilter = searchParams.get("verdict");

    let query = supabaseAdmin
      .from("submissions")
      .select("*")
      .not("submitted_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    if (verdictFilter) {
      if (verdictFilter === "pending") {
        query = query.is("verdict", null);
      } else {
        query = query.eq("verdict", verdictFilter);
      }
    }

    const { data: submissions, error } = await query;

    if (error) {
      console.error("Error fetching submissions:", error);
      return NextResponse.json(
        { error: "Failed to fetch submissions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ submissions: submissions || [] });
  } catch (error) {
    console.error("Admin submissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
