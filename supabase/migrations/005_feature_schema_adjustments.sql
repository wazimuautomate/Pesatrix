begin;

-- This patch assumes the base schema from 001/002 already exists.
-- It safely adds the extra database objects required by the
-- training, rewards, and referral-notification features.

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
          and au.status = 'active'
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
          and au.status = 'active'
      )
    )
    with check (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
          and au.status = 'active'
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
          and au.status = 'active'
      )
    )
    with check (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
          and au.status = 'active'
      )
    );
  end if;
end $$;

create table if not exists public.training_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'awaiting_test', 'completed')),
  current_day integer not null default 1 check (current_day between 1 and 7),
  current_stage integer not null default 1 check (current_stage between 1 and 3),
  stage_attempt integer not null default 1 check (stage_attempt >= 1),
  completed_days integer[] not null default '{}'::integer[],
  failed_stage_attempts jsonb not null default '{}'::jsonb,
  next_day_unlock_at timestamptz,
  last_completed_at timestamptz,
  completed_at timestamptz,
  reward_transaction_id uuid references public.wallet_transactions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists training_progress_status_idx
  on public.training_progress (status, current_stage, current_day);

drop trigger if exists training_progress_touch_updated_at on public.training_progress;
do $$
begin
  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'touch_updated_at'
  ) then
    create trigger training_progress_touch_updated_at
    before update on public.training_progress
    for each row
    execute function public.touch_updated_at();
  end if;
end $$;

alter table public.training_progress enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_progress'
      and policyname = 'Training progress readable by owner or admin'
  ) then
    create policy "Training progress readable by owner or admin"
    on public.training_progress
    for select
    using (
      user_id = auth.uid()
      or exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
          and au.status = 'active'
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_progress'
      and policyname = 'Training progress writable by admin only'
  ) then
    create policy "Training progress writable by admin only"
    on public.training_progress
    for all
    using (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
          and au.status = 'active'
      )
    )
    with check (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
          and au.status = 'active'
      )
    );
  end if;
end $$;

alter table public.referrals
  add column if not exists level integer not null default 1,
  add column if not exists source text not null default 'signup';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'referrals_level_check'
      and conrelid = 'public.referrals'::regclass
  ) then
    alter table public.referrals
      add constraint referrals_level_check
      check (level between 1 and 3);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'referrals_source_check'
      and conrelid = 'public.referrals'::regclass
  ) then
    alter table public.referrals
      add constraint referrals_source_check
      check (source in ('signup', 'admin', 'import'));
  end if;
end $$;

create unique index if not exists referrals_referee_level_unique_idx
  on public.referrals (referee_id, level);

create unique index if not exists referrals_referee_unique_idx
  on public.referrals (referee_id)
  where level = 1;

create index if not exists referrals_referrer_idx
  on public.referrals (referrer_id, created_at desc);

alter table public.referral_bonuses
  add column if not exists level integer,
  add column if not exists available_at timestamptz;

update public.referral_bonuses
set level = coalesce(level, 1)
where level is null;

alter table public.referral_bonuses
  alter column level set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'referral_bonuses_level_check'
      and conrelid = 'public.referral_bonuses'::regclass
  ) then
    alter table public.referral_bonuses
      add constraint referral_bonuses_level_check
      check (level between 1 and 3);
  end if;
end $$;

create index if not exists referral_bonuses_available_at_idx
  on public.referral_bonuses (available_at);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wallet_transactions'
      and column_name = 'type'
  ) then
    begin
      alter table public.wallet_transactions
        drop constraint if exists wallet_transactions_type_check;
      alter table public.wallet_transactions
        add constraint wallet_transactions_type_check
        check (type in ('task_earning', 'referral_bonus', 'activation_fee', 'withdrawal', 'admin_adjustment', 'reward', 'reversal'));
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
