import { supabase } from "./supabase";

// Check if Supabase tables are available (runs on first load, idempotent)
export async function ensureSupabaseTables() {
  const { error } = await supabase.from("users").select("id").limit(1);

  if (error && error.message.includes("does not exist")) {
    console.error("Supabase tables not found. Please run the SQL schema in the Supabase SQL Editor.");
    console.error("Schema file: /supabase_schema.sql");
    return false;
  }

  return true;
}
