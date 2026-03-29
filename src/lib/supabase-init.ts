import { supabase } from "./supabase";

// Try to create tables if they don't exist via RPC
// This runs on first load and is idempotent
export async function ensureSupabaseTables() {
  // Check if users table exists by trying a query
  const { error } = await supabase.from("users").select("id").limit(1);

  if (error && error.message.includes("does not exist")) {
    console.error("Supabase tables not found. Please run the SQL schema in the Supabase SQL Editor.");
    console.error("Schema file: /supabase_schema.sql");
    return false;
  }

  // Ensure demo user exists
  const { data: demo } = await supabase.from("users").select("id").eq("id", "usr_demo_winify").single();
  if (!demo) {
    await supabase.from("users").insert({
      id: "usr_demo_winify",
      name: "Jogador Demo",
      email: "demo@winify.com",
      cpf: "00000000000",
      password: "demo123",
      balance: 5000,
    });
  }

  return true;
}
