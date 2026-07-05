-- NFOP 4.0 Phase 1 — ONLINE FOUNDATION
-- Proposed projects table (review before enabling sync)
-- Run in Supabase Dashboard → SQL Editor

create table if not exists public.projects (
  id uuid primary key,
  project_number integer not null,
  title text not null default 'Neues Projekt',
  client_name text not null default '',
  phone text not null default '',
  email text not null default '',
  event_type text not null default '',
  event_date date,
  event_location text not null default '',
  package text not null default '',
  notes text not null default '',
  status text not null default 'NEW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default '',
  updated_by text not null default ''
);

comment on column public.projects.phone is
  'Client phone. NFOP field: project.phone';

comment on column public.projects.email is
  'Client email. NFOP field: project.email';

comment on column public.projects.event_location is
  'Formatted event venue address. NFOP: eventAddress / formatEventAddress()';

comment on column public.projects.package is
  'Primary catalog offer summary (e.g. Hochzeit Basic). Derived from [NF-ANGEBOT] in notes at sync time.';

comment on column public.projects.notes is
  'Full project notes including [NF-ANGEBOT] blocks. NFOP field: project.notes';

create index if not exists projects_updated_at_idx
  on public.projects (updated_at desc);

create index if not exists projects_event_date_idx
  on public.projects (event_date);

create or replace function public.nf_set_project_audit()
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

drop trigger if exists nf_projects_audit on public.projects;

create trigger nf_projects_audit
before insert or update on public.projects
for each row
execute function public.nf_set_project_audit();

alter table public.projects enable row level security;

drop policy if exists "nfop_phase1_anon_all" on public.projects;

create policy "nfop_phase1_anon_all"
on public.projects
for all
to anon, authenticated
using (true)
with check (true);

-- Run once. Ignore error if table is already in publication.
alter publication supabase_realtime add table public.projects;

-- Phase 2+ (NOT Phase 1): workflow tasks in separate table
-- create table public.project_tasks (
--   id uuid primary key default gen_random_uuid(),
--   project_id uuid not null references public.projects(id) on delete cascade,
--   label text not null,
--   done boolean not null default false,
--   sort_order integer not null default 0,
--   created_at timestamptz not null default now(),
--   updated_at timestamptz not null default now()
-- );
