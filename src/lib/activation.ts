import "server-only";

type SupabaseLike = {
  from: (table: never) => any;
};

type PaidActivationPayment = {
  id: string;
  user_id: string;
  status: string;
  paid_at: string | null;
};

type AccountStatusRow = {
  is_setup_complete?: boolean | null;
  state?: string | null;
  status?: string | null;
};

export async function getLatestPaidActivationPayment(
  supabase: SupabaseLike,
  userId: string
): Promise<PaidActivationPayment | null> {
  const { data, error } = await supabase
    .from("activation_payments" as never)
    .select("id, user_id, status, paid_at")
    .eq("user_id", userId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PaidActivationPayment | null) ?? null;
}

export async function hasPaidActivationPayment(supabase: SupabaseLike, userId: string) {
  return Boolean(await getLatestPaidActivationPayment(supabase, userId));
}

function nextInactiveStatus(status: AccountStatusRow | null): { state: string; status: string } {
  if (status?.state === "suspended" || status?.status === "suspended") {
    return { state: "suspended", status: "suspended" };
  }

  if (status?.state === "banned" || status?.status === "banned") {
    return { state: "banned", status: "banned" };
  }

  if (status?.is_setup_complete === true) {
    return { state: "setup_complete", status: "setup_complete" };
  }

  return { state: "registered", status: "registered" };
}

export async function syncAccountActivationFromPaidPayments(supabase: SupabaseLike, userId: string) {
  const paidPayment = await getLatestPaidActivationPayment(supabase, userId);

  if (paidPayment) {
    const { error } = await supabase
      .from("account_status" as never)
      .upsert(
        {
          user_id: userId,
          is_activated: true,
          activated_at: paidPayment.paid_at ?? new Date().toISOString(),
          state: "activated",
          status: "active",
        },
        { onConflict: "user_id" }
      );

    if (error) {
      throw error;
    }

    return true;
  }

  const { data: currentStatus, error: statusError } = await supabase
    .from("account_status" as never)
    .select("is_setup_complete, state, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (statusError) {
    throw statusError;
  }

  const inactiveStatus = nextInactiveStatus((currentStatus as AccountStatusRow | null) ?? null);
  const { error } = await supabase
    .from("account_status" as never)
    .upsert(
      {
        user_id: userId,
        is_activated: false,
        activated_at: null,
        ...inactiveStatus,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw error;
  }

  return false;
}
