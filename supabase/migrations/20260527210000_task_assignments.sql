begin;

-- Add starter flag to tasks table
alter table public.tasks add column if not exists is_starter boolean not null default false;
alter table public.tasks add column if not exists starter_day integer null; -- 1-6, which day it belongs to

-- Evolve task_assignments table
-- Make assigned_by nullable so system can assign automatically
alter table public.task_assignments alter column assigned_by drop not null;

-- Add new columns to task_assignments
alter table public.task_assignments add column if not exists unlocks_at timestamptz not null default now();
alter table public.task_assignments add column if not exists status text not null default 'locked';
alter table public.task_assignments add column if not exists created_at timestamptz not null default timezone('utc', now());

-- Add status check constraint
do $$
begin
  alter table public.task_assignments add constraint task_assignments_status_check 
    check (status in ('locked', 'available', 'completed', 'expired'));
exception
  when duplicate_object then null;
end $$;

-- Indexes
create index if not exists idx_task_assignments_user_id on public.task_assignments(user_id);
create index if not exists idx_task_assignments_unlocks_at on public.task_assignments(unlocks_at);
create index if not exists idx_task_assignments_status on public.task_assignments(status);

-- Database trigger to automatically set defaults for manual assignments (backward compatibility)
create or replace function public.set_task_assignment_defaults()
returns trigger as $$
begin
  if new.unlocks_at is null then
    new.unlocks_at := now();
  end if;
  if new.unlocks_at <= now() and new.status = 'locked' then
    new.status := 'available';
  end if;
  return new;
end;
$$ language plpgsql;

create or replace trigger trg_set_task_assignment_defaults
  before insert on public.task_assignments
  for each row
  execute function public.set_task_assignment_defaults();

notify pgrst, 'reload schema';

commit;
