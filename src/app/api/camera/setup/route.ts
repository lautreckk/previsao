export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  const results: string[] = [];

  try {
    // 1. Check if camera_markets table exists
    const { error: checkErr } = await supabase.from("camera_markets").select("id").limit(1);

    if (checkErr && checkErr.message.includes("does not exist")) {
      // Table doesn't exist — need to create via SQL Editor
      // But we can try using the Supabase SQL API
      results.push("camera_markets table does not exist. Attempting to create via REST...");

      // Create tables by inserting and handling the schema
      // Since Supabase REST can't run DDL, we'll need to create the tables
      // by using a workaround: call the SQL endpoint if available

      return NextResponse.json({
        status: "tables_missing",
        message: "Execute o SQL abaixo no Supabase SQL Editor (Dashboard → SQL Editor → New Query):",
        sql: `
-- Camera Markets
CREATE TABLE IF NOT EXISTS camera_markets (
  id TEXT PRIMARY KEY,
  stream_url TEXT NOT NULL,
  stream_type TEXT NOT NULL DEFAULT 'youtube',
  city TEXT DEFAULT '',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  current_count INTEGER NOT NULL DEFAULT 0,
  round_duration_seconds INTEGER NOT NULL DEFAULT 300,
  thumbnail_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Camera Rounds
CREATE TABLE IF NOT EXISTS camera_rounds (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES camera_markets(id),
  round_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NOT NULL,
  final_count INTEGER DEFAULT 0,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Camera Predictions
CREATE TABLE IF NOT EXISTS camera_predictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  market_id TEXT NOT NULL REFERENCES camera_markets(id),
  round_id TEXT REFERENCES camera_rounds(id),
  predicted_min INTEGER NOT NULL,
  predicted_max INTEGER NOT NULL,
  amount_brl DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_camera_rounds_market ON camera_rounds(market_id);
CREATE INDEX IF NOT EXISTS idx_camera_predictions_round ON camera_predictions(round_id);
CREATE INDEX IF NOT EXISTS idx_camera_predictions_user ON camera_predictions(user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE camera_markets;

-- Insert sample camera market (Rodovia Campos do Jordao)
INSERT INTO camera_markets (id, stream_url, stream_type, city, title, status, current_count, round_duration_seconds)
VALUES (
  'cam_rodovia_sp123',
  'https://www.youtube.com/watch?v=ByED80IKdIU',
  'youtube',
  'Campos do Jordao - SP',
  'Rodovia SP-123 Campos do Jordao',
  'open',
  0,
  300
) ON CONFLICT (id) DO NOTHING;

-- Insert sample round
INSERT INTO camera_rounds (id, market_id, round_number, started_at, ended_at)
VALUES (
  'round_sp123_1',
  'cam_rodovia_sp123',
  1,
  NOW(),
  NOW() + INTERVAL '5 minutes'
) ON CONFLICT (id) DO NOTHING;
        `.trim(),
        results,
      });
    }

    results.push("camera_markets table exists!");

    // 2. Check if we have any camera markets
    const { data: markets } = await supabase.from("camera_markets").select("id, title, status");
    results.push(`Camera markets: ${markets?.length || 0}`);

    if (!markets || markets.length === 0) {
      // Insert sample camera market
      await supabase.from("camera_markets").insert({
        id: "cam_rodovia_sp123",
        stream_url: "https://www.youtube.com/watch?v=ByED80IKdIU",
        stream_type: "youtube",
        city: "Campos do Jordao - SP",
        title: "Rodovia SP-123 Campos do Jordao",
        status: "open",
        current_count: 0,
        round_duration_seconds: 300,
      });
      results.push("Sample camera market created: cam_rodovia_sp123");

      // Create a round
      await supabase.from("camera_rounds").insert({
        id: "round_sp123_1",
        market_id: "cam_rodovia_sp123",
        round_number: 1,
        started_at: new Date().toISOString(),
        ended_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      results.push("Sample round created: 5 minutes from now");
    } else {
      results.push("Markets already exist: " + markets.map((m: { id: string; title: string }) => m.title).join(", "));
    }

    return NextResponse.json({ status: "ok", results });
  } catch (error) {
    return NextResponse.json({ error: String(error), results }, { status: 500 });
  }
}