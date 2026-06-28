-- Read-only checks for PaprFeed's public schema. Run this in Supabase SQL Editor.

-- Every table exposed through the Data API should show rowsecurity = true.
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- saved_papers should have exactly four owner-only policies for authenticated users.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- anon should have no table privileges on saved_papers.
select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'saved_papers'
order by grantee, privilege_type;
