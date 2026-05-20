begin;

-- ============================================================
-- Pesatrix Task Management System — New Schema
-- Migration 011
--
-- Replaces the flat admin_tasks table with a full-featured
-- task system supporting:
--   - Dynamic task_data per category (survey, data_labeling, etc.)
--   - Scheduling (publish_at, expires_at)
--   - AI grading pipeline
--   - User submissions with one-per-user-per-task constraint
--   - Wallet summary table
-- ============================================================

-- ============================================================
-- 1. tasks table
-- ============================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('survey', 'data_labeling', 'social_engagement', 'verification', 'content_creation', 'watch_respond')),
  description text,
  instructions text not null,
  payout_ksh numeric not null check (payout_ksh >= 0),
  total_slots integer not null check (total_slots > 0),
  slots_remaining integer not null check (slots_remaining >= 0),
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'hard')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'completed')),
  publish_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  ai_grading_enabled boolean not null default true,
  ai_rubric text,
  requires_screenshot boolean not null default false,
  requires_url boolean not null default false,
  min_word_count integer not null default 0 check (min_word_count >= 0),
  task_data jsonb not null
);

create index if not exists tasks_status_category_idx
  on public.tasks (status, category);

create index if not exists tasks_status_slots_idx
  on public.tasks (status, slots_remaining)
  where status = 'active' and slots_remaining > 0;

create index if not exists tasks_publish_at_idx
  on public.tasks (publish_at)
  where status = 'scheduled';

create index if not exists tasks_expires_at_idx
  on public.tasks (expires_at)
  where status = 'active' and expires_at is not null;

create index if not exists tasks_created_by_idx
  on public.tasks (created_by);

drop trigger if exists tasks_touch_updated_at on public.tasks;
do $$
begin
  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'touch_updated_at'
  ) then
    create trigger tasks_touch_updated_at
    before update on public.tasks
    for each row
    execute function public.touch_updated_at();
  end if;
end $$;

-- ============================================================
-- 2. task_submissions table
-- ============================================================
create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz not null default timezone('utc', now()),
  answers jsonb not null,
  screenshot_url text,
  submitted_url text,
  status text not null default 'pending' check (status in ('pending', 'ai_reviewing', 'approved', 'declined', 'flagged', 'admin_reviewed')),
  ai_score numeric check (ai_score >= 0 and ai_score <= 100),
  ai_reasoning text,
  ai_reviewed_at timestamptz,
  admin_reviewed_by uuid references auth.users(id) on delete set null,
  admin_decision text check (admin_decision in ('approved', 'declined')),
  admin_note text,
  admin_reviewed_at timestamptz,
  payout_credited boolean not null default false,
  payout_credited_at timestamptz,
  constraint task_submissions_unique_per_user_task unique (task_id, user_id)
);

create index if not exists task_submissions_task_status_idx
  on public.task_submissions (task_id, status);

create index if not exists task_submissions_user_status_idx
  on public.task_submissions (user_id, status, submitted_at desc);

create index if not exists task_submissions_status_idx
  on public.task_submissions (status)
  where status in ('flagged', 'pending');

create index if not exists task_submissions_ai_reviewing_idx
  on public.task_submissions (status)
  where status = 'ai_reviewing';

drop trigger if exists task_submissions_touch_submitted_at on public.task_submissions;
create or replace function public.touch_submitted_at()
returns trigger
language plpgsql
as $$
begin
  new.submitted_at := timezone('utc', now());
  return new;
end;
$$;

-- ============================================================
-- 3. wallets table (summary table, kept in sync via triggers)
-- ============================================================
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available_balance numeric not null default 0 check (available_balance >= 0),
  pending_balance numeric not null default 0 check (pending_balance >= 0),
  total_earned numeric not null default 0 check (total_earned >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists wallets_available_idx
  on public.wallets (available_balance desc);

drop trigger if exists wallets_touch_updated_at on public.wallets;
do $$
begin
  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'touch_updated_at'
  ) then
    create trigger wallets_touch_updated_at
    before update on public.wallets
    for each row
    execute function public.touch_updated_at();
  end if;
end $$;

-- ============================================================
-- 4. Wallet sync function — keeps wallets table in sync with
--    wallet_transactions on every insert/update
-- ============================================================
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
    available_balance = coalesce(
      (select sum(amount)
       from public.wallet_transactions
       where user_id = v_user_id
         and direction = 'credit'
         and status = 'available'), 0
    ),
    pending_balance = coalesce(
      (select sum(amount)
       from public.wallet_transactions
       where user_id = v_user_id
         and direction = 'credit'
         and status = 'pending'), 0
    ),
    total_earned = coalesce(
      (select sum(amount)
       from public.wallet_transactions
       where user_id = v_user_id
         and direction = 'credit'), 0
    ),
    updated_at = timezone('utc', now())
  where user_id = v_user_id;

  return null;
end;
$$;

drop trigger if exists wallet_transactions_sync_wallet on public.wallet_transactions;
create trigger wallet_transactions_sync_wallet
after insert or update on public.wallet_transactions
for each row
execute function public.sync_wallet_from_transactions();

-- ============================================================
-- 5. Auto-bootstrap wallet row on account activation
-- ============================================================
create or replace function public.bootstrap_wallet_on_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_activated = true and old.is_activated is not true then
    insert into public.wallets (user_id)
    values (new.user_id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists account_status_bootstrap_wallet on public.account_status;
create trigger account_status_bootstrap_wallet
after update on public.account_status
for each row
execute function public.bootstrap_wallet_on_activation();

-- ============================================================
-- 6. Row Level Security
-- ============================================================
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.wallets enable row level security;

-- tasks: readable by active admins; users see only active tasks
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tasks'
      and policyname = 'Tasks readable by active admins'
  ) then
    create policy "Tasks readable by active admins"
    on public.tasks for select
    using (
      exists (
        select 1 from public.admin_users au
        where au.user_id = auth.uid() and au.status = 'active'
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tasks'
      and policyname = 'Tasks visible to activated users'
  ) then
    create policy "Tasks visible to activated users"
    on public.tasks for select
    using (
      status = 'active'
      and slots_remaining > 0
      and (
        publish_at is null or publish_at <= now()
      )
      and (
        expires_at is null or expires_at > now()
      )
      and exists (
        select 1 from public.account_status acs
        where acs.user_id = auth.uid() and acs.is_activated = true
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tasks'
      and policyname = 'Tasks writable by active admins'
  ) then
    create policy "Tasks writable by active admins"
    on public.tasks for all
    using (
      exists (
        select 1 from public.admin_users au
        where au.user_id = auth.uid() and au.status = 'active'
          and au.role = 'admin'
      )
    )
    with check (
      exists (
        select 1 from public.admin_users au
        where au.user_id = auth.uid() and au.status = 'active'
          and au.role = 'admin'
      )
    );
  end if;
end $$;

-- task_submissions: users see own; admins see all
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'task_submissions'
      and policyname = 'Submissions readable by owner'
  ) then
    create policy "Submissions readable by owner"
    on public.task_submissions for select
    using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'task_submissions'
      and policyname = 'Submissions readable by active admins'
  ) then
    create policy "Submissions readable by active admins"
    on public.task_submissions for select
    using (
      exists (
        select 1 from public.admin_users au
        where au.user_id = auth.uid() and au.status = 'active'
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'task_submissions'
      and policyname = 'Submissions insert by authenticated users'
  ) then
    create policy "Submissions insert by authenticated users"
    on public.task_submissions for insert
    with check (
      user_id = auth.uid()
      and exists (
        select 1 from public.account_status acs
        where acs.user_id = auth.uid() and acs.is_activated = true
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'task_submissions'
      and policyname = 'Submissions writable by active admins'
  ) then
    create policy "Submissions writable by active admins"
    on public.task_submissions for update
    using (
      exists (
        select 1 from public.admin_users au
        where au.user_id = auth.uid() and au.status = 'active'
      )
    )
    with check (
      exists (
        select 1 from public.admin_users au
        where au.user_id = auth.uid() and au.status = 'active'
      )
    );
  end if;
end $$;

-- wallets: users see own; admins see all
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallets'
      and policyname = 'Wallets readable by owner'
  ) then
    create policy "Wallets readable by owner"
    on public.wallets for select
    using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallets'
      and policyname = 'Wallets readable by active admins'
  ) then
    create policy "Wallets readable by active admins"
    on public.wallets for select
    using (
      exists (
        select 1 from public.admin_users au
        where au.user_id = auth.uid() and au.status = 'active'
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallets'
      and policyname = 'Wallets writable by service role'
  ) then
    create policy "Wallets writable by service role"
    on public.wallets for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
  end if;
end $$;

-- ============================================================
-- 7. Grants
-- ============================================================
grant select, insert, update, delete on public.tasks to authenticated, service_role;
grant select, insert, update, delete on public.task_submissions to authenticated, service_role;
grant select, update on public.wallets to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- ============================================================
-- 8. Scheduling helper functions
-- ============================================================
create or replace function public.publish_scheduled_tasks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.tasks
  set status = 'active', updated_at = timezone('utc', now())
  where status = 'scheduled'
    and publish_at <= now()
    and publish_at is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.expire_active_tasks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.tasks
  set status = 'completed', updated_at = timezone('utc', now())
  where status = 'active'
    and expires_at is not null
    and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.publish_scheduled_tasks() to service_role;
grant execute on function public.expire_active_tasks() to service_role;

notify pgrst, 'reload schema';

commit;
