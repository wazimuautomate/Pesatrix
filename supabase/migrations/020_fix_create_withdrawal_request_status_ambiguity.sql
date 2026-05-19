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
