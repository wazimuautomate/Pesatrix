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
  console.log("--- Inspecting profiles ---");
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone")
    .limit(10);

  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log(`Found ${profiles ? profiles.length : 0} profiles:`);
    console.log(JSON.stringify(profiles, null, 2));
  }

  console.log("--- Inspecting admin_users ---");
  const { data: admins, error: errAdmins } = await supabase
    .from("admin_users")
    .select("*");

  if (errAdmins) {
    console.error("Error fetching admin users:", errAdmins);
  } else {
    console.log(`Found ${admins ? admins.length : 0} admin users:`);
    console.log(JSON.stringify(admins, null, 2));
  }
}

inspect().catch(console.error);
