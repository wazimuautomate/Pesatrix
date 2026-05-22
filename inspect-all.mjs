import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load .env file manually
const envPath = ".env";
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const tables = ["activation_payments", "wallet_transactions", "withdrawal_requests"];
  for (const t of tables) {
    const { data, count, error } = await supabase
      .from(t)
      .select("*", { count: "exact" });
    if (error) {
      console.error(`Error on ${t}:`, error.message);
    } else {
      console.log(`${t} count: ${count}`);
      if (data && data.length > 0) {
        console.log(`Sample of ${t}:`, JSON.stringify(data.slice(0, 2), null, 2));
      }
    }
  }
}

inspect().catch(console.error);
