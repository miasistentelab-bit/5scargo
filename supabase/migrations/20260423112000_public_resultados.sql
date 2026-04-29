create table if not exists public.inspecciones_publicas (
  inspeccion_id uuid primary key references public.inspecciones(id) on delete cascade,
  sector_id uuid not null,
  sector_nombre text not null,
  sector_emoji text,
  responsable text not null,
  mes int not null check (mes between 1 and 12),
  anio int not null check (anio between 2020 and 2100),
  puntaje_total numeric(5,2) default 0,
  finalizada_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists inspecciones_publicas_periodo_idx on public.inspecciones_publicas(anio, mes);

create table if not exists public.detalles_publicos (
  id uuid primary key default gen_random_uuid(),
  inspeccion_id uuid not null references public.inspecciones(id) on delete cascade,
  sub_item_nombre text not null,
  s1_puntaje int check (s1_puntaje in (0,25,75,100)),
  s2_puntaje int check (s2_puntaje in (0,25,75,100)),
  s3_puntaje int check (s3_puntaje in (0,25,75,100)),
  s4_puntaje int check (s4_puntaje in (0,25,75,100)),
  s5_puntaje int check (s5_puntaje in (0,25,75,100)),
  promedio numeric(5,2),
  created_at timestamptz not null default now()
);

create index if not exists detalles_publicos_insp_idx on public.detalles_publicos(inspeccion_id);
create unique index if not exists detalles_publicos_unique_idx on public.detalles_publicos(inspeccion_id, sub_item_nombre);

alter table public.inspecciones_publicas enable row level security;
alter table public.detalles_publicos enable row level security;

create policy "inspecciones_publicas_select_all" on public.inspecciones_publicas for select using (true);
create policy "detalles_publicos_select_all" on public.detalles_publicos for select using (true);

create policy "inspecciones_publicas_write_own" on public.inspecciones_publicas for all to authenticated
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.user_id = auth.uid()))
  with check (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.user_id = auth.uid() and i.estado = 'finalizada'));

create policy "detalles_publicos_write_own" on public.detalles_publicos for all to authenticated
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.user_id = auth.uid()))
  with check (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.user_id = auth.uid() and i.estado = 'finalizada'));

create or replace function public.publicar_inspeccion_finalizada()
returns trigger
language plpgsql
as $$
declare
  sec_nombre text;
  sec_emoji text;
begin
  if new.estado = 'finalizada' and old.estado = 'borrador' then
    select s.nombre, s.emoji into sec_nombre, sec_emoji
    from public.sectores s
    where s.id = new.sector_id;

    insert into public.inspecciones_publicas (inspeccion_id, sector_id, sector_nombre, sector_emoji, responsable, mes, anio, puntaje_total, finalizada_at, created_at)
    values (new.id, new.sector_id, coalesce(sec_nombre, ''), sec_emoji, new.responsable, new.mes, new.anio, new.puntaje_total, new.finalizada_at, new.created_at)
    on conflict (inspeccion_id) do update set
      sector_id = excluded.sector_id,
      sector_nombre = excluded.sector_nombre,
      sector_emoji = excluded.sector_emoji,
      responsable = excluded.responsable,
      mes = excluded.mes,
      anio = excluded.anio,
      puntaje_total = excluded.puntaje_total,
      finalizada_at = excluded.finalizada_at;

    delete from public.detalles_publicos where inspeccion_id = new.id;
    insert into public.detalles_publicos (inspeccion_id, sub_item_nombre, s1_puntaje, s2_puntaje, s3_puntaje, s4_puntaje, s5_puntaje, promedio, created_at)
    select d.inspeccion_id, d.sub_item_nombre, d.s1_puntaje, d.s2_puntaje, d.s3_puntaje, d.s4_puntaje, d.s5_puntaje, d.promedio, d.created_at
    from public.detalles_inspeccion d
    where d.inspeccion_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_publicar_inspeccion_finalizada on public.inspecciones;
create trigger trg_publicar_inspeccion_finalizada
  after update on public.inspecciones
  for each row execute function public.publicar_inspeccion_finalizada();

insert into public.inspecciones_publicas (inspeccion_id, sector_id, sector_nombre, sector_emoji, responsable, mes, anio, puntaje_total, finalizada_at, created_at)
select i.id, i.sector_id, s.nombre, s.emoji, i.responsable, i.mes, i.anio, i.puntaje_total, i.finalizada_at, i.created_at
from public.inspecciones i
join public.sectores s on s.id = i.sector_id
where i.estado = 'finalizada'
on conflict (inspeccion_id) do nothing;

insert into public.detalles_publicos (inspeccion_id, sub_item_nombre, s1_puntaje, s2_puntaje, s3_puntaje, s4_puntaje, s5_puntaje, promedio, created_at)
select d.inspeccion_id, d.sub_item_nombre, d.s1_puntaje, d.s2_puntaje, d.s3_puntaje, d.s4_puntaje, d.s5_puntaje, d.promedio, d.created_at
from public.detalles_inspeccion d
join public.inspecciones i on i.id = d.inspeccion_id
where i.estado = 'finalizada'
on conflict (inspeccion_id, sub_item_nombre) do nothing;
