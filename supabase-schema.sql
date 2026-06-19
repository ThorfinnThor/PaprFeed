create table if not exists public.saved_papers (
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id text not null,
  paper_json jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);

alter table public.saved_papers enable row level security;

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
