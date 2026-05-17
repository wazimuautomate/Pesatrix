-- ============================================================
-- Pesatrix production schema rebuild for Supabase
-- Generated: 2026-04-28
--
-- Scope:
-- - Resets all application-owned database objects in public
-- - Wires signup bootstrap from auth.users into application tables
-- - Recreates RLS, helper functions, triggers, and storage buckets
-- - Preserves Supabase-managed auth/storage internals; does not recreate
--   internal auth tables or dashboard-only Auth/JWT project settings
--
-- Safe to run on an empty project or to rebuild the application schema.
-- ============================================================

begin;

create extension if not exists "pgcrypto";

create schema if not exists public;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant usage on schema auth to authenticated, service_role;

-- ============================================================
-- Teardown existing application-owned objects
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists profiles_set_referral_code on public.profiles;
drop trigger if exists profiles_touch_updated_at on public.profiles;
drop trigger if exists account_status_sync_before_write on public.account_status;
drop trigger if exists account_status_touch_updated_at on public.account_status;
drop trigger if exists user_verification_touch_updated_at on public.user_verification;
drop trigger if exists activation_payments_touch_updated_at on public.activation_payments;
drop trigger if exists referral_bonuses_touch_updated_at on public.referral_bonuses;
drop trigger if exists wallet_transactions_touch_updated_at on public.wallet_transactions;
drop trigger if exists withdrawal_requests_touch_updated_at on public.withdrawal_requests;
drop trigger if exists support_tickets_touch_updated_at on public.support_tickets;
drop trigger if exists admin_users_touch_updated_at on public.admin_users;

drop policy if exists "Profiles are readable by owner or admin" on public.profiles;
drop policy if exists "Profiles are updateable by owner or admin" on public.profiles;
drop policy if exists "Profiles are insertable by service role only" on public.profiles;
drop policy if exists "Account status readable by owner or admin" on public.account_status;
drop policy if exists "Account status writable by admin only" on public.account_status;
drop policy if exists "Verification readable by owner or admin" on public.user_verification;
drop policy if exists "Verification writable by admin only" on public.user_verification;
drop policy if exists "Activation payments readable by owner or admin" on public.activation_payments;
drop policy if exists "Activation payments writable by admin only" on public.activation_payments;
drop policy if exists "Referrals readable by owner or admin" on public.referrals;
drop policy if exists "Referrals writable by admin only" on public.referrals;
drop policy if exists "Referral bonuses readable by owner or admin" on public.referral_bonuses;
drop policy if exists "Referral bonuses writable by admin only" on public.referral_bonuses;
drop policy if exists "Wallet transactions readable by owner or admin" on public.wallet_transactions;
drop policy if exists "Wallet transactions writable by admin only" on public.wallet_transactions;
drop policy if exists "Withdrawal requests readable by owner or admin" on public.withdrawal_requests;
drop policy if exists "Withdrawal requests insert by owner" on public.withdrawal_requests;
drop policy if exists "Withdrawal requests update by admin only" on public.withdrawal_requests;
drop policy if exists "Support tickets readable by owner or admin" on public.support_tickets;
drop policy if exists "Support tickets insert by owner" on public.support_tickets;
drop policy if exists "Support tickets update by owner or admin" on public.support_tickets;
drop policy if exists "Support messages readable by ticket owner or admin" on public.support_messages;
drop policy if exists "Support messages insert by ticket owner or admin" on public.support_messages;
drop policy if exists "Admin users readable by admins" on public.admin_users;
drop policy if exists "Admin users writable by admins" on public.admin_users;
drop policy if exists "Audit log readable by admins" on public.audit_log;
drop policy if exists "Audit log insert by admins" on public.audit_log;
drop function if exists public.handle_new_user();
drop function if exists public.generate_referral_code(text);
drop function if exists public.ensure_profile_referral_code();
drop function if exists public.touch_updated_at();
drop function if exists public.sync_account_status();
drop function if exists public.is_admin();
drop function if exists public.current_admin_role();
drop function if exists public.release_pending_wallet_credits();

drop table if exists public.audit_log cascade;
drop table if exists public.admin_users cascade;
drop table if exists public.support_messages cascade;
drop table if exists public.support_tickets cascade;
drop table if exists public.withdrawal_requests cascade;
drop table if exists public.wallet_transactions cascade;
drop table if exists public.referral_bonuses cascade;
drop table if exists public.referrals cascade;
drop table if exists public.activation_payments cascade;
drop table if exists public.user_verification cascade;
drop table if exists public.account_status cascade;
drop table if exists public.profiles cascade;

-- IMPORTANT:
-- Supabase forbids direct SQL deletes on storage metadata.
-- Do object deletion via the Storage API instead.
-- Keeping bucket upsert below is sufficient for rebuilds.

drop policy if exists "Support attachments are readable by owner or admin" on storage.objects;
drop policy if exists "Support attachments insert by owner path" on storage.objects;
drop policy if exists "Support attachments update by owner or admin" on storage.objects;
drop policy if exists "Support attachments delete by owner or admin" on storage.objects;
drop policy if exists "KYC documents are readable by owner or admin" on storage.objects;
drop policy if exists "KYC documents insert by owner path" on storage.objects;
drop policy if exists "KYC documents update by owner or admin" on storage.objects;
drop policy if exists "KYC documents delete by owner or admin" on storage.objects;

-- ============================================================
-- Helper functions
-- ============================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.generate_referral_code(seed_user_id text default null)
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(
      substring(
        md5(
          coalesce(seed_user_id, '') ||
          random()::text ||
          clock_timestamp()::text
        ),
        1,
        10
      )
    );

    if seed_user_id is not null then
      candidate := upper(substring(md5(seed_user_id || candidate), 1, 10));
    end if;

    exit when not exists (
      select 1
      from public.profiles
      where referral_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.ensure_profile_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null or btrim(new.referral_code) = '' then
    new.referral_code := public.generate_referral_code(new.id::text);
  else
    new.referral_code := upper(btrim(new.referral_code));
  end if;

  return new;
end;
$$;

create or replace function public.sync_account_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is not null then
    new.status := lower(new.status);
  end if;

  if new.state is not null then
    new.state := lower(new.state);
  end if;

  if new.status = 'active' then
    new.state := 'activated';
    new.is_activated := true;
    if new.activated_at is null then
      new.activated_at := timezone('utc', now());
    end if;
  elsif new.status = 'activated' then
    new.state := 'activated';
    new.is_activated := true;
    new.status := 'active';
    if new.activated_at is null then
      new.activated_at := timezone('utc', now());
    end if;
  elsif new.status = 'setup_complete' then
    new.state := 'setup_complete';
    new.is_setup_complete := true;
    if new.setup_completed_at is null then
      new.setup_completed_at := timezone('utc', now());
    end if;
  elsif new.status in ('registered', 'suspended', 'banned') and new.state is null then
    new.state := new.status;
  end if;

  if new.state = 'activated' then
    new.is_activated := true;
    if new.status is null then
      new.status := 'active';
    end if;
    if new.activated_at is null then
      new.activated_at := timezone('utc', now());
    end if;
  elsif new.state = 'setup_complete' then
    new.is_setup_complete := true;
    if new.status is null then
      new.status := 'setup_complete';
    end if;
    if new.setup_completed_at is null then
      new.setup_completed_at := timezone('utc', now());
    end if;
  elsif new.state in ('registered', 'suspended', 'banned') and new.status is null then
    new.status := new.state;
  end if;

  if new.state is null then
    new.state := 'registered';
  end if;

  if new.status is null then
    new.status := case
      when new.state = 'activated' then 'active'
      else new.state
    end;
  end if;

  return new;
end;
$$;

-- ============================================================
-- Core application tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  county text,
  referral_code text not null,
  referred_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_phone_format check (
    phone is null or phone ~ '^\+2547[0-9]{8}$'
  ),
  constraint profiles_email_format check (
    email is null or position('@' in email) > 1
  )
);

create unique index profiles_phone_unique_idx
  on public.profiles (phone)
  where phone is not null;

create unique index profiles_email_unique_idx
  on public.profiles ((lower(email)))
  where email is not null;

create unique index profiles_referral_code_unique_idx
  on public.profiles (referral_code);

create index profiles_referred_by_idx
  on public.profiles (referred_by);

create index profiles_created_at_idx
  on public.profiles (created_at desc);

create trigger profiles_set_referral_code
before insert on public.profiles
for each row
execute function public.ensure_profile_referral_code();

create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

create table public.account_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null default 'registered'
    check (state in ('registered', 'setup_complete', 'pending_activation', 'activated', 'suspended', 'banned')),
  status text not null default 'registered'
    check (status in ('registered', 'setup_complete', 'pending_activation', 'activated', 'active', 'suspended', 'banned')),
  is_setup_complete boolean not null default false,
  setup_completed_at timestamptz,
  is_activated boolean not null default false,
  activated_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index account_status_state_idx
  on public.account_status (state);

create index account_status_status_idx
  on public.account_status (status);

create index account_status_activation_idx
  on public.account_status (is_activated, is_setup_complete);

create trigger account_status_sync_before_write
before insert or update on public.account_status
for each row
execute function public.sync_account_status();

create trigger account_status_touch_updated_at
before update on public.account_status
for each row
execute function public.touch_updated_at();

create table public.user_verification (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_verified boolean not null default false,
  email_verified boolean not null default false,
  kyc_status text not null default 'not_started'
    check (kyc_status in ('not_started', 'pending', 'approved', 'rejected')),
  risk_score integer not null default 0 check (risk_score >= 0),
  flags jsonb not null default '{}'::jsonb,
  id_verified boolean not null default false,
  id_type text,
  id_number_hash text,
  selfie_url text,
  selfie_verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index user_verification_kyc_idx
  on public.user_verification (kyc_status);

create index user_verification_risk_idx
  on public.user_verification (risk_score desc);

create trigger user_verification_touch_updated_at
before update on public.user_verification
for each row
execute function public.touch_updated_at();

create table public.activation_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null default 500 check (amount = 500),
  phone text not null check (phone ~ '^\+?254[17][0-9]{8}$'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'reversed')),
  checkout_request_id text,
  merchant_request_id text,
  mpesa_receipt text,
  callback_raw jsonb,
  callback_validation_error text,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index activation_payments_checkout_request_id_unique_idx
  on public.activation_payments (checkout_request_id)
  where checkout_request_id is not null;

create unique index activation_payments_mpesa_receipt_unique_idx
  on public.activation_payments (mpesa_receipt)
  where mpesa_receipt is not null;

create index activation_payments_user_status_idx
  on public.activation_payments (user_id, status, created_at desc);

create trigger activation_payments_touch_updated_at
before update on public.activation_payments
for each row
execute function public.touch_updated_at();

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referee_id uuid not null references auth.users(id) on delete cascade,
  level integer not null default 1 check (level between 1 and 3),
  source text not null default 'signup'
    check (source in ('signup', 'admin', 'import')),
  created_at timestamptz not null default timezone('utc', now()),
  constraint referrals_referrer_not_self check (referrer_id <> referee_id)
);

create unique index referrals_referee_level_unique_idx
  on public.referrals (referee_id, level);

create unique index referrals_referee_unique_idx
  on public.referrals (referee_id)
  where level = 1;

create index referrals_referrer_idx
  on public.referrals (referrer_id, created_at desc);

create table public.referral_bonuses (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referee_id uuid not null references auth.users(id) on delete cascade,
  level integer not null check (level between 1 and 3),
  amount integer not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'available', 'revoked')),
  available_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint referral_bonuses_unique_per_level unique (referrer_id, referee_id, level)
);

create index referral_bonuses_referrer_status_idx
  on public.referral_bonuses (referrer_id, status, created_at desc);

create index referral_bonuses_available_at_idx
  on public.referral_bonuses (available_at)
  where available_at is not null;

create trigger referral_bonuses_touch_updated_at
before update on public.referral_bonuses
for each row
execute function public.touch_updated_at();

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null
    check (type in ('task_earning', 'referral_bonus', 'activation_fee', 'withdrawal', 'admin_adjustment', 'reward', 'reversal')),
  direction text not null
    check (direction in ('credit', 'debit')),
  amount integer not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'available', 'locked', 'reversed')),
  bucket text not null default 'pending'
    check (bucket in ('pending', 'available', 'locked')),
  description text,
  reference_table text,
  reference_id uuid,
  available_at timestamptz,
  created_by_admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index wallet_transactions_user_created_idx
  on public.wallet_transactions (user_id, created_at desc);

create index wallet_transactions_user_status_idx
  on public.wallet_transactions (user_id, status, available_at);

create index wallet_transactions_reference_idx
  on public.wallet_transactions (reference_table, reference_id);

create index wallet_transactions_release_idx
  on public.wallet_transactions (status, direction, available_at)
  where status = 'pending' and direction = 'credit';

create trigger wallet_transactions_touch_updated_at
before update on public.wallet_transactions
for each row
execute function public.touch_updated_at();

create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  phone text not null check (phone ~ '^\+2547[0-9]{8}$'),
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'sent', 'failed', 'held')),
  mpesa_txn_id text,
  failure_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index withdrawal_requests_user_created_idx
  on public.withdrawal_requests (user_id, created_at desc);

create index withdrawal_requests_status_idx
  on public.withdrawal_requests (status, created_at desc);

create trigger withdrawal_requests_touch_updated_at
before update on public.withdrawal_requests
for each row
execute function public.touch_updated_at();

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  subject text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  assigned_admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index support_tickets_user_updated_idx
  on public.support_tickets (user_id, updated_at desc);

create index support_tickets_status_priority_idx
  on public.support_tickets (status, priority, updated_at desc);

create index support_tickets_assigned_admin_idx
  on public.support_tickets (assigned_admin_id, status);

create trigger support_tickets_touch_updated_at
before update on public.support_tickets
for each row
execute function public.touch_updated_at();

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'admin')),
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  attachment_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create index support_messages_ticket_created_idx
  on public.support_messages (ticket_id, created_at asc);

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null
    check (role in ('super_admin', 'admin', 'support', 'finance', 'fraud')),
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_login_at timestamptz
);

create index admin_users_role_status_idx
  on public.admin_users (role, status);

create trigger admin_users_touch_updated_at
before update on public.admin_users
for each row
execute function public.touch_updated_at();

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_json jsonb,
  after_json jsonb,
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

create index audit_log_admin_created_idx
  on public.audit_log (admin_id, created_at desc);

create index audit_log_entity_idx
  on public.audit_log (entity_type, entity_id, created_at desc);

-- ============================================================
-- Authorization helpers
-- ============================================================

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select au.role
  from public.admin_users au
  where au.user_id = auth.uid()
    and au.status = 'active'
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.status = 'active'
  )
$$;

grant execute on function public.current_admin_role() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- ============================================================
-- Signup bootstrap trigger
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_metadata jsonb;
  v_email text;
  v_phone text;
  v_full_name text;
  v_referral_input text;
  v_referrer_id uuid;
begin
  v_metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_email := nullif(lower(coalesce(new.email, v_metadata ->> 'email')), '');
  v_phone := nullif(replace(coalesce(new.phone, v_metadata ->> 'phone', ''), ' ', ''), '');
  v_full_name := nullif(btrim(v_metadata ->> 'full_name'), '');
  v_referral_input := upper(nullif(btrim(v_metadata ->> 'referral_code'), ''));

  if v_phone is not null then
    if v_phone ~ '^07[0-9]{8}$' then
      v_phone := '+254' || right(v_phone, 9);
    elsif v_phone ~ '^2547[0-9]{8}$' then
      v_phone := '+' || v_phone;
    end if;
  end if;

  insert into public.profiles (
    id,
    full_name,
    phone,
    email,
    metadata
  )
  values (
    new.id,
    v_full_name,
    v_phone,
    v_email,
    v_metadata
  )
  on conflict (id) do update
  set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    email = coalesce(public.profiles.email, excluded.email),
    metadata = public.profiles.metadata || excluded.metadata;

  insert into public.account_status (user_id, state, status)
  values (new.id, 'registered', 'registered')
  on conflict (user_id) do nothing;

  insert into public.user_verification (
    user_id,
    email_verified,
    phone_verified
  )
  values (
    new.id,
    false,
    false
  )
  on conflict (user_id) do update
  set
    user_id = excluded.user_id;

  if v_referral_input is not null then
    begin
      select p.id
      into v_referrer_id
      from public.profiles p
      where p.referral_code = v_referral_input
        and p.id <> new.id
      limit 1;

      if v_referrer_id is not null then
        update public.profiles
        set referred_by = v_referrer_id
        where id = new.id
          and referred_by is distinct from v_referrer_id;

        insert into public.referrals (
          referrer_id,
          referee_id,
          level,
          source
        )
        values (
          v_referrer_id,
          new.id,
          1,
          'signup'
        )
        on conflict (referee_id, level) do nothing;
      end if;
    exception
      when others then
        null;
    end;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

grant execute on function public.handle_new_user() to service_role;

-- ============================================================
-- Business procedures
-- ============================================================

create or replace function public.release_pending_wallet_credits()
returns table (
  released_transactions integer,
  released_bonuses integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_ids uuid[];
  v_bonus_ids uuid[];
  v_released_transactions integer := 0;
  v_released_bonuses integer := 0;
begin
  select coalesce(array_agg(wt.id), '{}')::uuid[],
         coalesce(array_agg(wt.reference_id) filter (
           where wt.reference_table = 'referral_bonuses'
             and wt.reference_id is not null
         ), '{}')::uuid[]
  into v_transaction_ids, v_bonus_ids
  from public.wallet_transactions wt
  where wt.status = 'pending'
    and wt.direction = 'credit'
    and wt.available_at is not null
    and wt.available_at <= timezone('utc', now());

  if coalesce(array_length(v_transaction_ids, 1), 0) > 0 then
    update public.wallet_transactions
    set
      status = 'available',
      bucket = 'available',
      updated_at = timezone('utc', now())
    where id = any(v_transaction_ids);

    get diagnostics v_released_transactions = row_count;
  end if;

  if coalesce(array_length(v_bonus_ids, 1), 0) > 0 then
    update public.referral_bonuses
    set
      status = 'available',
      updated_at = timezone('utc', now())
    where id = any(v_bonus_ids);

    get diagnostics v_released_bonuses = row_count;
  end if;

  return query
  select v_released_transactions, v_released_bonuses;
end;
$$;

grant execute on function public.release_pending_wallet_credits() to service_role;

-- ============================================================
-- Row level security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.account_status enable row level security;
alter table public.user_verification enable row level security;
alter table public.activation_payments enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_bonuses enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.admin_users enable row level security;
alter table public.audit_log enable row level security;

create policy "Profiles are readable by owner or admin"
on public.profiles
for select
using (id = auth.uid() or public.is_admin());

create policy "Profiles are updateable by owner or admin"
on public.profiles
for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "Profiles are insertable by service role only"
on public.profiles
for insert
with check (auth.role() = 'service_role');

create policy "Account status readable by owner or admin"
on public.account_status
for select
using (user_id = auth.uid() or public.is_admin());

create policy "Account status writable by admin only"
on public.account_status
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Verification readable by owner or admin"
on public.user_verification
for select
using (user_id = auth.uid() or public.is_admin());

create policy "Verification writable by admin only"
on public.user_verification
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Activation payments readable by owner or admin"
on public.activation_payments
for select
using (user_id = auth.uid() or public.is_admin());

create policy "Activation payments writable by admin only"
on public.activation_payments
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Referrals readable by owner or admin"
on public.referrals
for select
using (
  referrer_id = auth.uid()
  or referee_id = auth.uid()
  or public.is_admin()
);

create policy "Referrals writable by admin only"
on public.referrals
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Referral bonuses readable by owner or admin"
on public.referral_bonuses
for select
using (referrer_id = auth.uid() or public.is_admin());

create policy "Referral bonuses writable by admin only"
on public.referral_bonuses
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Wallet transactions readable by owner or admin"
on public.wallet_transactions
for select
using (user_id = auth.uid() or public.is_admin());

create policy "Wallet transactions writable by admin only"
on public.wallet_transactions
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Withdrawal requests readable by owner or admin"
on public.withdrawal_requests
for select
using (user_id = auth.uid() or public.is_admin());

create policy "Withdrawal requests insert by owner"
on public.withdrawal_requests
for insert
with check (user_id = auth.uid());

create policy "Withdrawal requests update by admin only"
on public.withdrawal_requests
for update
using (public.is_admin())
with check (public.is_admin());

create policy "Support tickets readable by owner or admin"
on public.support_tickets
for select
using (user_id = auth.uid() or public.is_admin());

create policy "Support tickets insert by owner"
on public.support_tickets
for insert
with check (user_id = auth.uid());

create policy "Support tickets update by owner or admin"
on public.support_tickets
for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "Support messages readable by ticket owner or admin"
on public.support_messages
for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.support_tickets st
    where st.id = support_messages.ticket_id
      and st.user_id = auth.uid()
  )
);

create policy "Support messages insert by ticket owner or admin"
on public.support_messages
for insert
with check (
  (
    sender_type = 'user'
    and sender_id = auth.uid()
    and exists (
      select 1
      from public.support_tickets st
      where st.id = support_messages.ticket_id
        and st.user_id = auth.uid()
    )
  )
  or (
    sender_type = 'admin'
    and public.is_admin()
  )
);

create policy "Admin users readable by admins"
on public.admin_users
for select
using (public.is_admin());

create policy "Admin users writable by admins"
on public.admin_users
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Audit log readable by admins"
on public.audit_log
for select
using (public.is_admin());

create policy "Audit log insert by admins"
on public.audit_log
for insert
with check (public.is_admin());

-- ============================================================
-- Grants
-- ============================================================

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- ============================================================
-- Storage buckets and object policies
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'support-attachments',
    'support-attachments',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']
  ),
  (
    'kyc-documents',
    'kyc-documents',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Support attachments are readable by owner or admin"
on storage.objects
for select
using (
  bucket_id = 'support-attachments'
  and (
    public.is_admin()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "Support attachments insert by owner path"
on storage.objects
for insert
with check (
  bucket_id = 'support-attachments'
  and auth.uid() is not null
  and auth.uid()::text = split_part(name, '/', 1)
);

create policy "Support attachments update by owner or admin"
on storage.objects
for update
using (
  bucket_id = 'support-attachments'
  and (
    public.is_admin()
    or auth.uid()::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = 'support-attachments'
  and (
    public.is_admin()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "Support attachments delete by owner or admin"
on storage.objects
for delete
using (
  bucket_id = 'support-attachments'
  and (
    public.is_admin()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "KYC documents are readable by owner or admin"
on storage.objects
for select
using (
  bucket_id = 'kyc-documents'
  and (
    public.is_admin()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "KYC documents insert by owner path"
on storage.objects
for insert
with check (
  bucket_id = 'kyc-documents'
  and auth.uid() is not null
  and auth.uid()::text = split_part(name, '/', 1)
);

create policy "KYC documents update by owner or admin"
on storage.objects
for update
using (
  bucket_id = 'kyc-documents'
  and (
    public.is_admin()
    or auth.uid()::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = 'kyc-documents'
  and (
    public.is_admin()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "KYC documents delete by owner or admin"
on storage.objects
for delete
using (
  bucket_id = 'kyc-documents'
  and (
    public.is_admin()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

commit;

-- ============================================================
-- Validation queries
-- Run after migration to confirm deployment.
-- ============================================================

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'account_status',
    'user_verification',
    'activation_payments',
    'referrals',
    'referral_bonuses',
    'wallet_transactions',
    'withdrawal_requests',
    'support_tickets',
    'support_messages',
    'admin_users',
    'audit_log'
  )
order by table_name;

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'account_status',
    'user_verification',
    'activation_payments',
    'referrals',
    'referral_bonuses',
    'wallet_transactions',
    'withdrawal_requests',
    'support_tickets',
    'support_messages',
    'admin_users',
    'audit_log'
  )
order by tablename;

select
  proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'handle_new_user',
    'generate_referral_code',
    'ensure_profile_referral_code',
    'touch_updated_at',
    'sync_account_status',
    'is_admin',
    'current_admin_role',
    'release_pending_wallet_credits'
  )
order by proname;

select
  id,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in ('support-attachments', 'kyc-documents')
order by id;

-- ============================================================
-- Rollback block
-- Uncomment and run only if you need to remove the rebuilt schema.
-- ============================================================
-- begin;
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.handle_new_user();
-- drop function if exists public.generate_referral_code(text);
-- drop function if exists public.ensure_profile_referral_code();
-- drop function if exists public.touch_updated_at();
-- drop function if exists public.sync_account_status();
-- drop function if exists public.is_admin();
-- drop function if exists public.current_admin_role();
-- drop function if exists public.release_pending_wallet_credits();
-- drop table if exists public.audit_log cascade;
-- drop table if exists public.admin_users cascade;
-- drop table if exists public.support_messages cascade;
-- drop table if exists public.support_tickets cascade;
-- drop table if exists public.withdrawal_requests cascade;
-- drop table if exists public.wallet_transactions cascade;
-- drop table if exists public.referral_bonuses cascade;
-- drop table if exists public.referrals cascade;
-- drop table if exists public.activation_payments cascade;
-- drop table if exists public.user_verification cascade;
-- drop table if exists public.account_status cascade;
-- drop table if exists public.profiles cascade;
-- No rollback SQL deletes of storage.objects/storage.buckets.
-- Use the Storage API if you need to remove files or buckets.
-- commit;
