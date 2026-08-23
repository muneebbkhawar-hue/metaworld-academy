-- MetaWorld Research Academy - tool access control schema.
--
-- Run this ONCE in the Supabase dashboard: Project -> SQL Editor -> New
-- query -> paste this whole file -> Run. Safe to re-run (uses IF NOT
-- EXISTS / OR REPLACE throughout).
--
-- Auth itself is handled entirely by Supabase's built-in `auth.users`
-- table (passwordless email magic-link sign-in) - this file only adds the
-- one table this app actually needs: per-user, per-tool access requests
-- and their approval state.

create table if not exists public.tool_access (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  requester_name text not null,
  tool_id text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  unique (user_email, tool_id)
);

create index if not exists tool_access_email_idx on public.tool_access (user_email);
create index if not exists tool_access_status_idx on public.tool_access (status);

-- Row Level Security: the browser only ever reads its own requests (to
-- show "pending"/"approved" status); all writes (creating a request,
-- approving/denying) go through server-side API routes using the
-- service_role key, which bypasses RLS entirely - so these policies only
-- need to cover the read-your-own-rows case for the anon/authenticated
-- client used in the browser.
alter table public.tool_access enable row level security;

drop policy if exists "users can read their own access rows" on public.tool_access;
create policy "users can read their own access rows"
  on public.tool_access for select
  using (auth.jwt() ->> 'email' = user_email);
