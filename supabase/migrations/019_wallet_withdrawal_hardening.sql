create or replace function public.sync_wallet_from_transactions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := coalesce(new.user_id, old.user_id);
  if v_user_id is null then
    return null;
  end if;

  insert into public.wallets (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  update public.wallets
  set
    available_balance = greatest(
      coalesce(
        (
          select sum(amount)
          from public.wallet_transactions
          where user_id = v_user_id
            and direction = 'credit'
            and status = 'available'
        ),
        0
      ) -
      coalesce(
        (
          select sum(amount)
          from public.wallet_transactions
          where user_id = v_user_id
            and direction = 'debit'
            and status in ('locked', 'available')
        ),
        0
      ),
      0
    ),
    pending_balance = coalesce(
      (
        select sum(amount)
        from public.wallet_transactions
        where user_id = v_user_id
          and direction = 'credit'
          and status = 'pending'
      ),
      0
    ),
    total_earned = coalesce(
      (
        select sum(amount)
        from public.wallet_transactions
        where user_id = v_user_id
          and direction = 'credit'
      ),
      0
    ),
    updated_at = timezone('utc', now())
  where user_id = v_user_id;

  return null;
end;
$$;

drop trigger if exists wallet_transactions_sync_wallet on public.wallet_transactions;
create trigger wallet_transactions_sync_wallet
after insert or update or delete on public.wallet_transactions
for each row
execute function public.sync_wallet_from_transactions();

create unique index if not exists withdrawal_requests_one_active_per_user_idx
  on public.withdrawal_requests (user_id)
  where status in ('requested', 'processing', 'held');

create unique index if not exists wallet_transactions_withdrawal_reference_direction_idx
  on public.wallet_transactions (reference_table, reference_id, direction)
  where reference_table = 'withdrawal_requests';

create or replace function public.create_withdrawal_request(
  p_user_id uuid,
  p_amount integer,
  p_phone text,
  p_description text default null
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
  v_withdrawal public.withdrawal_requests%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if p_phone is null or p_phone !~ '^\+2547[0-9]{8}$' then
    raise exception 'INVALID_PHONE';
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

  insert into public.withdrawal_requests (user_id, amount, phone, status)
  values (p_user_id, p_amount, p_phone, 'requested')
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
    'available',
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

insert into public.platform_settings (key, value, description)
values (
  'withdrawal_n8n_webhook_url',
  '',
  'Optional n8n webhook URL triggered after a withdrawal request is created.'
)
on conflict (key) do nothing;
