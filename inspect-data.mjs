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
  console.log("--- Inspecting wallet_transactions ---");
  const { data: txs, error: txsError } = await supabase
    .from("wallet_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (txsError) {
    console.error("Error fetching transactions:", txsError);
  } else {
    console.log(`Found ${txs ? txs.length : 0} transactions:`);
    console.log(JSON.stringify(txs, null, 2));
  }

  console.log("\n--- Inspecting withdrawal_requests ---");
  const { data: wrs, error: wrsError } = await supabase
    .from("withdrawal_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (wrsError) {
    console.error("Error fetching withdrawal requests:", wrsError);
  } else {
    console.log(`Found ${wrs ? wrs.length : 0} withdrawal requests:`);
    console.log(JSON.stringify(wrs, null, 2));
  }
}

inspect().catch(console.error);
