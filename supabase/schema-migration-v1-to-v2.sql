-- NFOP 4.0 Phase 1 — migrate projects table v1 → v2
-- Use only if you already applied the earlier minimal schema (11 columns)

alter table public.projects
  add column if not exists phone text not null default '',
  add column if not exists email text not null default '',
  add column if not exists event_location text not null default '',
  add column if not exists package text not null default '',
  add column if not exists notes text not null default '';

comment on column public.projects.phone is
  'Client phone. NFOP field: project.phone';

comment on column public.projects.email is
  'Client email. NFOP field: project.email';

comment on column public.projects.event_location is
  'Formatted event venue address. NFOP: eventAddress / formatEventAddress()';

comment on column public.projects.package is
  'Primary catalog offer summary. Derived from [NF-ANGEBOT] in notes at sync time.';

comment on column public.projects.notes is
  'Full project notes including [NF-ANGEBOT] blocks. NFOP field: project.notes';

create index if not exists projects_event_date_idx
  on public.projects (event_date);
