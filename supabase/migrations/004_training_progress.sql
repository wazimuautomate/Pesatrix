begin;

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

do $$
begin
  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'touch_updated_at'
  ) then
    drop trigger if exists training_progress_touch_updated_at on public.training_progress;
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

commit;
