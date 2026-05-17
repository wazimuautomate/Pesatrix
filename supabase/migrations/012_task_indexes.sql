begin;

create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_category on public.tasks(category);

notify pgrst, 'reload schema';

commit;
