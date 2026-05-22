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

const admin = createClient(supabaseUrl, supabaseKey);

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function run() {
  console.log("Running dashboard queries...");
  try {
    const [
      usersCount,
      paidPayments,
      pendingWithdrawals,
      openTickets,
      completedTraining,
      riskRows,
      recentPaymentsResult,
    ] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("activation_payments").select("amount").eq("status", "paid").limit(1000),
      admin.from("withdrawal_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["requested", "processing", "held"]),
      admin.from("support_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress", "waiting_on_user"]),
      admin.from("training_progress")
        .select("user_id", { count: "exact", head: true })
        .eq("status", "completed"),
      admin.from("user_verification")
        .select("user_id", { count: "exact", head: true })
        .gte("risk_score", 70),
      admin.from("wallet_transactions")
        .select("id, amount, status, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    console.log("usersCount:", usersCount.count, "error:", usersCount.error);
    console.log("paidPayments count:", paidPayments.data ? paidPayments.data.length : 0, "error:", paidPayments.error);
    console.log("pendingWithdrawals:", pendingWithdrawals.count, "error:", pendingWithdrawals.error);
    console.log("openTickets:", openTickets.count, "error:", openTickets.error);
    console.log("completedTraining:", completedTraining.count, "error:", completedTraining.error);
    console.log("riskRows:", riskRows.count, "error:", riskRows.error);
    console.log("recentPaymentsResult:", recentPaymentsResult.data ? recentPaymentsResult.data.length : 0, "error:", recentPaymentsResult.error);

    if (recentPaymentsResult.data) {
      console.log("Recent Payments Data:", JSON.stringify(recentPaymentsResult.data, null, 2));
      const paymentRows = asArray(recentPaymentsResult.data);
      const paymentUserIds = [...new Set(paymentRows.map((row) => row.user_id).filter(Boolean))];
      console.log("paymentUserIds:", paymentUserIds);

      let paymentProfilesById = new Map();
      if (paymentUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await admin.from("profiles")
          .select("id, full_name, email")
          .in("id", paymentUserIds);
        console.log("Profiles fetch error:", profilesError);
        if (!profilesError && profiles) {
          paymentProfilesById = new Map(
            profiles.map((p) => [p.id, { full_name: p.full_name, email: p.email }])
          );
        }
      }

      const recentPayments = paymentRows.map((row) => ({
        ...row,
        profiles: paymentProfilesById.get(row.user_id) ?? null,
      }));
      console.log("Mapped Recent Payments:", JSON.stringify(recentPayments, null, 2));
    }
  } catch (err) {
    console.error("Query failed:", err);
  }
}

run();
