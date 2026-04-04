import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as admin, checkAdminSecret, unauthorized } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return unauthorized();
  }

  // Check if affiliate tables already exist
  const { error: testErr } = await admin.from("affiliates").select("id").limit(1);
  if (!testErr) {
    return NextResponse.json({ success: true, message: "Affiliate tables already exist" });
  }

  // Tables don't exist — provide instructions for manual creation
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace("https://", "")
    .replace(".supabase.co", "")
    .trim();

  return NextResponse.json({
    success: false,
    message: "Affiliate tables not found. Run the migration SQL in Supabase Dashboard.",
    instructions: `https://supabase.com/dashboard/project/${ref}/sql/new`,
  });
}
