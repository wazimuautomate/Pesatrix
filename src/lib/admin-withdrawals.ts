import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AdminWithdrawalRecord = {
  amount: number;
  amount_after_fee: number | null;
  b2c_request_id: string | null;
  b2c_conversation_id: string | null;
  b2c_originator_id: string | null;
  b2c_result_code: string | null;
  b2c_result_desc: string | null;
  b2c_initiated_at: string | null;
  last_reconciled_at: string | null;
  created_at: string;
  fee_ksh: number | null;
  failure_reason: string | null;
  id: string;
  mpesa_txn_id: string | null;
  phone: string;
  processed_at: string | null;
  profiles: {
    email: string | null;
    full_name: string | null;
    phone?: string | null;
  } | null;
  status: string;
  user_id: string;
};

type GetWithdrawalsOptions = {
  id?: string;
  limit?: number;
  status?: string | null;
};

export async function getAdminWithdrawals(options: GetWithdrawalsOptions = {}) {
  const admin = createAdminSupabaseClient();
  let query = (admin.from("withdrawal_requests" as never) as any)
    .select(
      "id, user_id, amount, fee_ksh, amount_after_fee, phone, status, mpesa_txn_id, failure_reason, b2c_request_id, b2c_conversation_id, b2c_originator_id, b2c_result_code, b2c_result_desc, b2c_initiated_at, last_reconciled_at, created_at, processed_at"
    )
    .order("created_at", { ascending: false });

  if (options.id) {
    query = query.eq("id", options.id);
  }

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data: withdrawals, error } = await query;
  if (error) {
    throw error;
  }

  const rows = (withdrawals ?? []) as Array<Omit<AdminWithdrawalRecord, "profiles">>;
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];

  let profilesById = new Map<string, AdminWithdrawalRecord["profiles"]>();
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await (admin.from("profiles" as never) as any)
      .select("id, full_name, email, phone")
      .in("id", userIds);

    if (profilesError) {
      throw profilesError;
    }

    profilesById = new Map(
      ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null; phone: string | null }>).map(
        (profile) => [
          profile.id,
          {
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone,
          },
        ]
      )
    );
  }

  return rows.map((row) => ({
    ...row,
    profiles: profilesById.get(row.user_id) ?? null,
  })) satisfies AdminWithdrawalRecord[];
}

export async function getAdminWithdrawalById(id: string) {
  const rows = await getAdminWithdrawals({ id });
  return rows[0] ?? null;
}
