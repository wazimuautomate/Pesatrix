-- Add soft-delete support to profiles table
-- This allows "deleting" users without destroying auth.users or cascading

alter table public.profiles
  add column if not exists deleted_at timestamptz null;

create index if not exists profiles_deleted_at_idx
  on public.profiles (deleted_at)
  where deleted_at is not null;
