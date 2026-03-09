// testUsers.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv/load.ts";

const supabase = createClient(
  Deno.env.get("VITE_SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!
);

const { data: users, error } = await supabase.auth.admin.listUsers();

if (error) console.error("Error:", error);
else console.log("Users:", users);