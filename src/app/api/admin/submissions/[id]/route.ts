import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, R2_BUCKET } from "@/lib/r2/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("steamid64", session.user.steamId)
      .single();

    if (!roleData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const { data: submission, error } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ submission });
  } catch (error) {
    console.error("Get submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("steamid64", session.user.steamId)
      .single();

    if (!roleData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, verdict, admin_notes, tags } = body;

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (verdict !== undefined) updateData.verdict = verdict;
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
    if (tags !== undefined) updateData.tags = tags;

    const { data: submission, error } = await supabaseAdmin
      .from("submissions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update submission error:", error);
      return NextResponse.json(
        { error: "Failed to update submission" },
        { status: 500 }
      );
    }

    return NextResponse.json({ submission });
  } catch (error) {
    console.error("Patch submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("steamid64", session.user.steamId)
      .single();

    if (!roleData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Get the submission to find the R2 key
    const { data: submission } = await supabaseAdmin
      .from("submissions")
      .select("demo_r2_key")
      .eq("id", id)
      .single();

    // Delete from R2 first
    if (submission?.demo_r2_key) {
      try {
        const r2 = getR2Client();
        await r2.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: submission.demo_r2_key,
          })
        );
      } catch (r2Error) {
        console.error("R2 delete error (continuing):", r2Error);
      }
    }

    // Delete from database
    const { error } = await supabaseAdmin
      .from("submissions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete submission error:", error);
      return NextResponse.json(
        { error: "Failed to delete submission" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
