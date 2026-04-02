import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gqymalmbbtzdnpbneegg.supabase.co").trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeW1hbG1iYnR6ZG5wYm5lZWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjUzNDYsImV4cCI6MjA5MDIwMTM0Nn0.Mj_L0h3HGfG4X22Qb3f53oeipNXa91nIGW5-J_zl-kM").trim();

export const supabase = createClient(supabaseUrl, supabaseKey);
