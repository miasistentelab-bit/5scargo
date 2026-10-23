-- 1. Robustecer el trigger para sincronizar inspecciones finalizadas a las tablas públicas
create or replace function public.publicar_inspeccion_finalizada()
returns trigger
language plpgsql
as $$
declare
  sec_nombre text;
  sec_emoji text;
begin
  if new.estado = 'finalizada' then
    select s.nombre, s.emoji into sec_nombre, sec_emoji
    from public.sectores s
    where s.id = new.sector_id;

    insert into public.inspecciones_publicas (
      inspeccion_id, sector_id, sector_nombre, sector_emoji, responsable, mes, anio, puntaje_total, finalizada_at, created_at
    )
    values (
      new.id, new.sector_id, coalesce(sec_nombre, ''), sec_emoji, new.responsable, new.mes, new.anio, new.puntaje_total, new.finalizada_at, new.created_at
    )
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
  elsif new.estado = 'borrador' then
    delete from public.inspecciones_publicas where inspeccion_id = new.id;
    delete from public.detalles_publicos where inspeccion_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_publicar_inspeccion_finalizada on public.inspecciones;
create trigger trg_publicar_inspeccion_finalizada
  after insert or update on public.inspecciones
  for each row execute function public.publicar_inspeccion_finalizada();

-- 2. Restricción única para evitar duplicados por sector/mes/año
-- Primero limpiamos posibles duplicados existentes (nos quedamos con el más reciente)
delete from public.inspecciones
where id in (
  select id from (
    select id, row_number() over (partition by sector_id, mes, anio order by updated_at desc) as rn
    from public.inspecciones
  ) t
  where rn > 1
);

alter table public.inspecciones drop constraint if exists inspecciones_sector_periodo_unique;
alter table public.inspecciones add constraint inspecciones_sector_periodo_unique unique (sector_id, mes, anio);

-- 3. Permitir que usuarios autenticados vean TODAS las inspecciones (no solo las propias)
drop policy if exists "inspecciones_select_own" on public.inspecciones;
create policy "inspecciones_select_auth" on public.inspecciones for select to authenticated using (true);

drop policy if exists "detalles_select_own" on public.detalles_inspeccion;
create policy "detalles_select_auth" on public.detalles_inspeccion for select to authenticated using (true);

-- 4. Sincronización manual de datos existentes
insert into public.inspecciones_publicas (
  inspeccion_id, sector_id, sector_nombre, sector_emoji, responsable, mes, anio, puntaje_total, finalizada_at, created_at
)
select i.id, i.sector_id, s.nombre, s.emoji, i.responsable, i.mes, i.anio, i.puntaje_total, i.finalizada_at, i.created_at
from public.inspecciones i
join public.sectores s on s.id = i.sector_id
where i.estado = 'finalizada'
on conflict (inspeccion_id) do update set
  sector_id = excluded.sector_id,
  sector_nombre = excluded.sector_nombre,
  sector_emoji = excluded.sector_emoji,
  responsable = excluded.responsable,
  mes = excluded.mes,
  anio = excluded.anio,
  puntaje_total = excluded.puntaje_total,
  finalizada_at = excluded.finalizada_at;

insert into public.detalles_publicos (inspeccion_id, sub_item_nombre, s1_puntaje, s2_puntaje, s3_puntaje, s4_puntaje, s5_puntaje, promedio, created_at)
select d.inspeccion_id, d.sub_item_nombre, d.s1_puntaje, d.s2_puntaje, d.s3_puntaje, d.s4_puntaje, d.s5_puntaje, d.promedio, d.created_at
from public.detalles_inspeccion d
join public.inspecciones i on i.id = d.inspeccion_id
where i.estado = 'finalizada'
on conflict (inspeccion_id, sub_item_nombre) do update set
  s1_puntaje = excluded.s1_puntaje,
  s2_puntaje = excluded.s2_puntaje,
  s3_puntaje = excluded.s3_puntaje,
  s4_puntaje = excluded.s4_puntaje,
  s5_puntaje = excluded.s5_puntaje,
  promedio = excluded.promedio;
