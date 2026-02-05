import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    // Get total submissions count
    const { count: totalSubmissions } = await supabaseAdmin
      .from("submissions")
      .select("*", { count: "exact", head: true });

    // Get cheaters found (verdict = 'cheater')
    const { count: cheatersFound } = await supabaseAdmin
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("verdict", "cheater");

    // Get reviewed count (status = 'reviewed')
    const { count: reviewed } = await supabaseAdmin
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "reviewed");

    return NextResponse.json({
      submissions: totalSubmissions || 0,
      cheatersFound: cheatersFound || 0,
      reviewed: reviewed || 0,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({
      submissions: 0,
      cheatersFound: 0,
      reviewed: 0,
    });
  }
}
