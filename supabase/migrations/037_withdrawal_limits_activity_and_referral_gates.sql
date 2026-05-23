begin;

insert into public.platform_settings (key, value, description) values
  ('withdrawal_max_single_amount', '1000', 'Max KSh a user can withdraw in a single request'),
  ('withdrawal_max_daily_amount', '2000', 'Max KSh a user can withdraw total per day'),
  ('withdrawal_max_daily_count', '2', 'Max number of withdrawal requests per user per day'),
  ('high_task_payout_threshold', '100', 'Min payout KSh for a task to require community size gate'),
  ('high_task_referral_requirement', '5', 'Activated referrals needed to access high-payout tasks')
on conflict (key) do nothing;

create table if not exists public.user_activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  event_type text not null check (event_type in ('page_view', 'task_started', 'task_submitted', 'withdrawal_requested', 'login', 'referral_shared')),
  page_path text,
  metadata jsonb default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default timezone('utc', now())
);

create index if not exists user_activity_logs_user_created_at_idx
  on public.user_activity_logs (user_id, created_at desc);

create index if not exists user_activity_logs_event_created_at_idx
  on public.user_activity_logs (event_type, created_at desc);

alter table public.user_activity_logs enable row level security;

drop policy if exists "Activity logs readable by admins only" on public.user_activity_logs;
create policy "Activity logs readable by admins only"
  on public.user_activity_logs for select
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status = 'active'
    )
  );

create or replace function public.create_withdrawal_request(
  p_user_id uuid,
  p_amount integer,
  p_phone text,
  p_description text default null,
  p_fee_ksh integer default 30,
  p_amount_after_fee integer default null
)
returns table (
  id uuid,
  amount integer,
  phone text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available integer;
  v_fee integer;
  v_amount_after_fee integer;
  v_withdrawal public.withdrawal_requests%rowtype;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_today_count integer;
  v_today_total integer;
  v_max_single integer;
  v_max_daily_amount integer;
  v_max_daily_count integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if p_phone is null or p_phone !~ '^\+254[17][0-9]{8}$' then
    raise exception 'INVALID_PHONE';
  end if;

  select case when value ~ '^[0-9]+$' then value::integer else 500 end
  into v_max_single
  from public.platform_settings
  where key = 'withdrawal_max_single_amount';
  v_max_single := coalesce(v_max_single, 500);

  select case when value ~ '^[0-9]+$' then value::integer else 1000 end
  into v_max_daily_amount
  from public.platform_settings
  where key = 'withdrawal_max_daily_amount';
  v_max_daily_amount := coalesce(v_max_daily_amount, 1000);

  select case when value ~ '^[0-9]+$' then value::integer else 1 end
  into v_max_daily_count
  from public.platform_settings
  where key = 'withdrawal_max_daily_count';
  v_max_daily_count := coalesce(v_max_daily_count, 1);

  if p_amount > v_max_single then
    raise exception 'LIMIT_SINGLE';
  end if;

  select count(*), coalesce(sum(wr.amount), 0)
  into v_today_count, v_today_total
  from public.withdrawal_requests as wr
  where wr.user_id = p_user_id
    and wr.created_at >= v_day_start
    and wr.status <> 'failed';

  if v_today_total + p_amount > v_max_daily_amount then
    raise exception 'LIMIT_DAILY_AMOUNT';
  end if;

  if v_today_count >= v_max_daily_count then
    raise exception 'LIMIT_DAILY_COUNT';
  end if;

  v_fee := greatest(coalesce(p_fee_ksh, 30), 30);
  v_amount_after_fee := coalesce(p_amount_after_fee, p_amount - v_fee);

  if v_amount_after_fee <= 0 then
    raise exception 'FEE_EXCEEDS_AMOUNT';
  end if;

  insert into public.wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select w.available_balance
  into v_available
  from public.wallets as w
  where w.user_id = p_user_id
  for update;

  v_available := coalesce(v_available, 0);

  if v_available < p_amount then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  if exists (
    select 1
    from public.withdrawal_requests as wr
    where wr.user_id = p_user_id
      and wr.status in ('requested', 'processing', 'held')
  ) then
    raise exception 'ACTIVE_WITHDRAWAL_EXISTS';
  end if;

  insert into public.withdrawal_requests (user_id, amount, fee_ksh, amount_after_fee, phone, status)
  values (p_user_id, p_amount, v_fee, v_amount_after_fee, p_phone, 'requested')
  returning *
  into v_withdrawal;

  insert into public.wallet_transactions (
    user_id,
    type,
    direction,
    amount,
    status,
    bucket,
    description,
    reference_table,
    reference_id
  )
  values (
    p_user_id,
    'withdrawal',
    'debit',
    p_amount,
    'locked',
    'locked',
    coalesce(p_description, 'Withdrawal to ' || p_phone),
    'withdrawal_requests',
    v_withdrawal.id
  );

  return query
  select
    v_withdrawal.id,
    v_withdrawal.amount,
    v_withdrawal.phone,
    v_withdrawal.status,
    v_withdrawal.created_at;
exception
  when unique_violation then
    raise exception 'ACTIVE_WITHDRAWAL_EXISTS';
end;
$$;

notify pgrst, 'reload schema';

commit;
