-- NFOP 4.1 — Shared calendar: supervisor day blocks
-- Run in Supabase Dashboard → SQL Editor (after schema.sql / projects table exists)
--
-- Steps:
--   1. Open https://supabase.com/dashboard → your NFOP project
--   2. SQL Editor → New query
--   3. Paste this file and Run
--   4. Confirm Table Editor shows public.supervisor_blocks
--   5. Database → Replication → supabase_realtime includes supervisor_blocks
--
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP IF EXISTS guards).

create table if not exists public.supervisor_blocks (
  block_day date primary key,
  reason text not null default 'Privat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default '',
  updated_by text not null default ''
);

comment on table public.supervisor_blocks is
  'Supervisor calendar day blocks (BLUE). NFOP local cache key: nfBlockedDays.';

comment on column public.supervisor_blocks.block_day is
  'Calendar day YYYY-MM-DD. Primary key — one block per day.';

comment on column public.supervisor_blocks.reason is
  'Human-readable block reason shown in supervisor + operator calendars.';

create or replace function public.nf_set_supervisor_block_audit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_at is null then
      new.created_at := now();
    end if;
    if new.updated_at is null then
      new.updated_at := new.created_at;
    end if;
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists nf_supervisor_blocks_audit on public.supervisor_blocks;

create trigger nf_supervisor_blocks_audit
before insert or update on public.supervisor_blocks
for each row
execute function public.nf_set_supervisor_block_audit();

alter table public.supervisor_blocks enable row level security;

-- Realtime DELETE must include block_day in payload.old (NFOP 4.1 unblock sync)
alter table public.supervisor_blocks replica identity full;

drop policy if exists "nfop_41_anon_supervisor_blocks" on public.supervisor_blocks;

create policy "nfop_41_anon_supervisor_blocks"
on public.supervisor_blocks
for all
to anon, authenticated
using (true)
with check (true);

-- Run once. Safe if already in publication.
do $$
begin
  alter publication supabase_realtime add table public.supervisor_blocks;
exception
  when duplicate_object then
    null;
end $$;
