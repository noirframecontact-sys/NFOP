-- NFOP 4.1 — TYLKO supervisor_blocks (bezpieczne, bez błędu projects)
-- Supabase → SQL Editor → Run

create table if not exists public.supervisor_blocks (
  block_day date primary key,
  reason text not null default 'Privat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default '',
  updated_by text not null default ''
);

alter table public.supervisor_blocks enable row level security;

drop policy if exists "nfop_41_anon_supervisor_blocks" on public.supervisor_blocks;

create policy "nfop_41_anon_supervisor_blocks"
on public.supervisor_blocks for all to anon, authenticated
using (true) with check (true);

alter table public.supervisor_blocks replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.supervisor_blocks;
exception
  when duplicate_object then
    null;
end $$;

-- Sprawdź wynik (powinna być 1 tabela):
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'supervisor_blocks';

-- Odśwież cache API (jeśli apka nadal widzi PGRST205):
notify pgrst, 'reload schema';
