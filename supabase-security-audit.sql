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

-- anon should have no rows. authenticated should have only
-- SELECT, INSERT, UPDATE, and DELETE. postgres privileges are intentionally omitted.
select
  grantee,
  privilege_type,
  case
    when grantee = 'authenticated'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE') then 'EXPECTED'
    else 'UNEXPECTED - REMOVE'
  end as audit_status
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'saved_papers'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;
