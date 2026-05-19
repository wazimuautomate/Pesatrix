begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-screenshots',
  'task-screenshots',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Task screenshots are readable by owner or admin" on storage.objects;
drop policy if exists "Task screenshots insert by owner path" on storage.objects;
drop policy if exists "Task screenshots update by owner or admin" on storage.objects;
drop policy if exists "Task screenshots delete by owner or admin" on storage.objects;

create policy "Task screenshots are readable by owner or admin"
on storage.objects
for select
using (
  bucket_id = 'task-screenshots'
  and (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
        and au.status = 'active'
    )
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "Task screenshots insert by owner path"
on storage.objects
for insert
with check (
  bucket_id = 'task-screenshots'
  and auth.uid() is not null
  and auth.uid()::text = split_part(name, '/', 1)
);

create policy "Task screenshots update by owner or admin"
on storage.objects
for update
using (
  bucket_id = 'task-screenshots'
  and (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
        and au.status = 'active'
    )
    or auth.uid()::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = 'task-screenshots'
  and (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
        and au.status = 'active'
    )
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "Task screenshots delete by owner or admin"
on storage.objects
for delete
using (
  bucket_id = 'task-screenshots'
  and (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
        and au.status = 'active'
    )
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

alter table public.task_submissions
  add column if not exists screenshot_hash text,
  add column if not exists ip text,
  add column if not exists user_task_banned boolean not null default false;

create index if not exists task_submissions_user_task_banned_idx
  on public.task_submissions (task_id, user_id)
  where user_task_banned = true;

create index if not exists task_submissions_screenshot_hash_idx
  on public.task_submissions (task_id, screenshot_hash)
  where screenshot_hash is not null;

create index if not exists task_submissions_task_ip_submitted_idx
  on public.task_submissions (task_id, ip, submitted_at desc)
  where ip is not null;

alter table public.task_submissions
  drop constraint if exists task_submissions_unique_per_user_task;

drop index if exists task_submissions_unique_open_per_user_task_idx;
create unique index task_submissions_unique_open_per_user_task_idx
  on public.task_submissions (task_id, user_id)
  where status <> 'declined';

create or replace function public.decrement_task_slot(p_task_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  update public.tasks
  set slots_remaining = slots_remaining - 1,
      updated_at = timezone('utc', now())
  where id = p_task_id
    and slots_remaining > 0
    and status = 'active';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

grant execute on function public.decrement_task_slot(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
