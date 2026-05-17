create table if not exists public.reward_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spin_type text not null check (spin_type in ('free', 'paid')),
  outcome text not null check (outcome in ('miss', 'small', 'medium', 'double', 'jackpot')),
  payout_amount integer not null default 0 check (payout_amount >= 0),
  spin_cost integer not null default 0 check (spin_cost >= 0),
  net_amount integer not null default 0,
  entropy_digest text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists reward_spins_user_created_idx
  on public.reward_spins (user_id, created_at desc);

create index if not exists reward_spins_user_type_created_idx
  on public.reward_spins (user_id, spin_type, created_at desc);

alter table public.reward_spins enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reward_spins'
      and policyname = 'Reward spins readable by owner or admin'
  ) then
    create policy "Reward spins readable by owner or admin"
    on public.reward_spins
    for select
    using (
      auth.uid() = user_id
      or exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reward_spins'
      and policyname = 'Reward spins writable by admin only'
  ) then
    create policy "Reward spins writable by admin only"
    on public.reward_spins
    for all
    using (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
      )
    );
  end if;
end $$;

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email')),
  event_type text not null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  recipient_email text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider text,
  external_id text,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz
);

create index if not exists notification_outbox_status_created_idx
  on public.notification_outbox (status, created_at asc);

create index if not exists notification_outbox_recipient_idx
  on public.notification_outbox (recipient_user_id, created_at desc);

alter table public.notification_outbox enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_outbox'
      and policyname = 'Notification outbox writable by admin only'
  ) then
    create policy "Notification outbox writable by admin only"
    on public.notification_outbox
    for all
    using (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
      )
    );
  end if;
end $$;
