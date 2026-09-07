-- Cinema Tools v0.1.0 — saved options per project (SSOT for this app's writes)
-- Same shape as aesthetic_configs / lighting_configs (+ is_final).
-- RLS mirrors the family: anon SELECT / INSERT / UPDATE, no DELETE (archive flag).
create table if not exists public.cinema_tools_configs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete set null,
  project_name  text,
  label         text not null,
  config        jsonb not null default '{}'::jsonb,
  app_version   text,
  is_final      boolean not null default false,
  archived      boolean not null default false,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.cinema_tools_configs is
  'Cinema Tools v0.1.0 — saved quick-calc options per project (screen/viewing/projector/riser/room/audio). One row may be is_final=true per project; that option is mirrored to projects.metadata.cinema_tools (via sonor_merge_project_metadata) for Cinema Design to reference. Writes: Cinema Tools only. RLS: anon SELECT/INSERT/UPDATE, no DELETE.';

create index if not exists cinema_tools_configs_project_idx on public.cinema_tools_configs (project_id, archived, updated_at desc);
-- at most one FINAL per project
create unique index if not exists cinema_tools_configs_one_final on public.cinema_tools_configs (project_id) where is_final and not archived;

alter table public.cinema_tools_configs enable row level security;
drop policy if exists cinema_tools_configs_sel on public.cinema_tools_configs;
drop policy if exists cinema_tools_configs_ins on public.cinema_tools_configs;
drop policy if exists cinema_tools_configs_upd on public.cinema_tools_configs;
create policy cinema_tools_configs_sel on public.cinema_tools_configs for select using (true);
create policy cinema_tools_configs_ins on public.cinema_tools_configs for insert with check (true);
create policy cinema_tools_configs_upd on public.cinema_tools_configs for update using (true);

-- registry row so Master Hub / health checks see the app
insert into public.app_versions (app_key, version, app_name, repo, url_local, url_hosted, metadata)
values ('cinema-tools', '0.1.0', 'Cinema Tools', 'sonor-cinema-tools',
        '../APP - Cinema Tools/dashboard/sonor-cinema-tools.html',
        'https://sonorltd.github.io/sonor-cinema-tools/',
        '{"class":"app","notes":"v0.1.0: quick-calc companion to Cinema Design — screen/viewing/projector/riser/room/audio, scale plan + section, saved options per project, ★ Final → projects.metadata.cinema_tools"}'::jsonb)
on conflict (app_key) do update set version = excluded.version, app_name = excluded.app_name, repo = excluded.repo, url_local = excluded.url_local, url_hosted = excluded.url_hosted, metadata = excluded.metadata, updated_at = now();
