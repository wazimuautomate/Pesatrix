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
          select sum(wt.amount)
          from public.wallet_transactions as wt
          where wt.user_id = v_user_id
            and wt.direction = 'credit'
            and wt.bucket = 'available'
            and wt.status <> 'reversed'
        ),
        0
      ) -
      coalesce(
        (
          select sum(wt.amount)
          from public.wallet_transactions as wt
          where wt.user_id = v_user_id
            and wt.direction = 'debit'
            and wt.bucket = 'available'
            and wt.status <> 'reversed'
        ),
        0
      ),
      0
    ),
    pending_balance = coalesce(
      (
        select sum(wt.amount)
        from public.wallet_transactions as wt
        where wt.user_id = v_user_id
          and wt.direction = 'credit'
          and wt.bucket = 'pending'
          and wt.status = 'pending'
      ),
      0
    ),
    total_earned = coalesce(
      (
        select sum(wt.amount)
        from public.wallet_transactions as wt
        where wt.user_id = v_user_id
          and wt.direction = 'credit'
          and wt.status <> 'reversed'
      ),
      0
    ),
    updated_at = timezone('utc', now())
  where user_id = v_user_id;

  return null;
end;
$$;

insert into public.wallets (user_id)
select distinct wt.user_id
from public.wallet_transactions as wt
on conflict (user_id) do nothing;

update public.wallets as w
set
  available_balance = greatest(
    coalesce(
      (
        select sum(wt.amount)
        from public.wallet_transactions as wt
        where wt.user_id = w.user_id
          and wt.direction = 'credit'
          and wt.bucket = 'available'
          and wt.status <> 'reversed'
      ),
      0
    ) -
    coalesce(
      (
        select sum(wt.amount)
        from public.wallet_transactions as wt
        where wt.user_id = w.user_id
          and wt.direction = 'debit'
          and wt.bucket = 'available'
          and wt.status <> 'reversed'
      ),
      0
    ),
    0
  ),
  pending_balance = coalesce(
    (
      select sum(wt.amount)
      from public.wallet_transactions as wt
      where wt.user_id = w.user_id
        and wt.direction = 'credit'
        and wt.bucket = 'pending'
        and wt.status = 'pending'
    ),
    0
  ),
  total_earned = coalesce(
    (
      select sum(wt.amount)
      from public.wallet_transactions as wt
      where wt.user_id = w.user_id
        and wt.direction = 'credit'
        and wt.status <> 'reversed'
    ),
    0
  ),
  updated_at = timezone('utc', now());
