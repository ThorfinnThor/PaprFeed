create table if not exists public.saved_papers (
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id text not null,
  paper_json jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);

alter table public.saved_papers enable row level security;

revoke all on public.saved_papers from anon;
grant select, insert, update, delete on public.saved_papers to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'saved_papers_paper_id_length'
  ) then
    alter table public.saved_papers
    add constraint saved_papers_paper_id_length
    check (char_length(paper_id) between 1 and 300);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'saved_papers_json_is_object'
  ) then
    alter table public.saved_papers
    add constraint saved_papers_json_is_object
    check (jsonb_typeof(paper_json) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'saved_papers_json_size'
  ) then
    alter table public.saved_papers
    add constraint saved_papers_json_size
    check (octet_length(paper_json::text) <= 20000);
  end if;
end $$;

create or replace function public.enforce_saved_papers_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.saved_papers
    where user_id = new.user_id and paper_id = new.paper_id
  ) and (
    select count(*)
    from public.saved_papers
    where user_id = new.user_id
  ) >= 500 then
    raise exception 'saved paper limit reached';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_saved_papers_limit() from public;

drop trigger if exists enforce_saved_papers_limit on public.saved_papers;
create trigger enforce_saved_papers_limit
before insert on public.saved_papers
for each row
execute function public.enforce_saved_papers_limit();

drop policy if exists "Users can read own saved papers" on public.saved_papers;
create policy "Users can read own saved papers"
on public.saved_papers
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own saved papers" on public.saved_papers;
create policy "Users can insert own saved papers"
on public.saved_papers
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own saved papers" on public.saved_papers;
create policy "Users can update own saved papers"
on public.saved_papers
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own saved papers" on public.saved_papers;
create policy "Users can delete own saved papers"
on public.saved_papers
for delete
to authenticated
using (auth.uid() = user_id);
