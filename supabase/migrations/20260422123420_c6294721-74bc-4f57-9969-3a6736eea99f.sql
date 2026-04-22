
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sectores
create table public.sectores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  emoji text default '📦',
  orden int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.sectores enable row level security;
create policy "sectores_select_auth" on public.sectores for select to authenticated using (true);
create policy "sectores_all_auth" on public.sectores for all to authenticated using (true) with check (true);

-- Sub items
create table public.sub_items (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.sectores(id) on delete cascade,
  nombre text not null,
  foto_maestra_url text,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.sub_items enable row level security;
create policy "sub_items_select_auth" on public.sub_items for select to authenticated using (true);
create policy "sub_items_all_auth" on public.sub_items for all to authenticated using (true) with check (true);

-- Inspecciones
create type public.inspeccion_estado as enum ('borrador', 'finalizada');

create table public.inspecciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  responsable text not null,
  sector_id uuid not null references public.sectores(id) on delete restrict,
  mes int not null check (mes between 1 and 12),
  anio int not null check (anio between 2020 and 2100),
  estado public.inspeccion_estado not null default 'borrador',
  puntaje_total numeric(5,2) default 0,
  finalizada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inspecciones_user_idx on public.inspecciones(user_id);
create index inspecciones_periodo_idx on public.inspecciones(anio, mes);
alter table public.inspecciones enable row level security;
create policy "inspecciones_select_own" on public.inspecciones for select using (auth.uid() = user_id);
create policy "inspecciones_insert_own" on public.inspecciones for insert with check (auth.uid() = user_id);
create policy "inspecciones_update_own" on public.inspecciones for update using (auth.uid() = user_id and estado = 'borrador');
create policy "inspecciones_delete_own" on public.inspecciones for delete using (auth.uid() = user_id and estado = 'borrador');

-- Trigger: bloquear edición de finalizadas
create or replace function public.bloquear_inspeccion_finalizada()
returns trigger language plpgsql as $$
begin
  if old.estado = 'finalizada' then
    raise exception 'No se puede modificar una inspección finalizada (integridad de auditoría)';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger bloquear_update_finalizada
  before update on public.inspecciones
  for each row execute function public.bloquear_inspeccion_finalizada();

-- Detalles
create table public.detalles_inspeccion (
  id uuid primary key default gen_random_uuid(),
  inspeccion_id uuid not null references public.inspecciones(id) on delete cascade,
  sub_item_id uuid not null references public.sub_items(id) on delete restrict,
  sub_item_nombre text not null,
  s1_puntaje int check (s1_puntaje in (0,25,75,100)),
  s2_puntaje int check (s2_puntaje in (0,25,75,100)),
  s3_puntaje int check (s3_puntaje in (0,25,75,100)),
  s4_puntaje int check (s4_puntaje in (0,25,75,100)),
  s5_puntaje int check (s5_puntaje in (0,25,75,100)),
  promedio numeric(5,2) generated always as (
    (coalesce(s1_puntaje,0) + coalesce(s2_puntaje,0) + coalesce(s3_puntaje,0) + coalesce(s4_puntaje,0) + coalesce(s5_puntaje,0))::numeric / 5
  ) stored,
  foto_evidencia_url text,
  observaciones text,
  ia_sugerido_puntaje int,
  ia_comentario text,
  created_at timestamptz not null default now(),
  unique (inspeccion_id, sub_item_id)
);
create index detalles_insp_idx on public.detalles_inspeccion(inspeccion_id);
alter table public.detalles_inspeccion enable row level security;

create policy "detalles_select_own" on public.detalles_inspeccion for select
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.user_id = auth.uid()));
create policy "detalles_insert_own" on public.detalles_inspeccion for insert
  with check (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.user_id = auth.uid() and i.estado = 'borrador'));
create policy "detalles_update_own" on public.detalles_inspeccion for update
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.user_id = auth.uid() and i.estado = 'borrador'));
create policy "detalles_delete_own" on public.detalles_inspeccion for delete
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.user_id = auth.uid() and i.estado = 'borrador'));

-- Storage bucket
insert into storage.buckets (id, name, public) values ('evidencias', 'evidencias', true);

create policy "evidencias_select_public" on storage.objects for select using (bucket_id = 'evidencias');
create policy "evidencias_insert_auth" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "evidencias_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'evidencias' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "evidencias_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and auth.uid()::text = (storage.foldername(name))[1]);

-- Seed data
insert into public.sectores (nombre, emoji, orden) values
  ('OFICINAS Y SSGG', '🏢', 1),
  ('DEPOSITO', '📦', 2),
  ('PREDIO', '🏭', 3);

insert into public.sub_items (sector_id, nombre, orden)
select s.id, sub.nombre, sub.orden
from public.sectores s
cross join lateral (values
  ('Recepción', 1),
  ('Oficina Administración', 2),
  ('Sala de Reuniones', 3),
  ('Cocina / Comedor', 4),
  ('Baños', 5)
) as sub(nombre, orden)
where s.nombre = 'OFICINAS Y SSGG';

insert into public.sub_items (sector_id, nombre, orden)
select s.id, sub.nombre, sub.orden
from public.sectores s
cross join lateral (values
  ('Oficinas Cargo', 1),
  ('Alero Sur', 2),
  ('Alero Ingreso', 3),
  ('Pasillo Central', 4),
  ('Estantería A', 5),
  ('Estantería B', 6),
  ('Zona de Picking', 7)
) as sub(nombre, orden)
where s.nombre = 'DEPOSITO';

insert into public.sub_items (sector_id, nombre, orden)
select s.id, sub.nombre, sub.orden
from public.sectores s
cross join lateral (values
  ('Playa de Maniobras', 1),
  ('Estacionamiento', 2),
  ('Perímetro Externo', 3),
  ('Zona Carga / Descarga', 4)
) as sub(nombre, orden)
where s.nombre = 'PREDIO';
