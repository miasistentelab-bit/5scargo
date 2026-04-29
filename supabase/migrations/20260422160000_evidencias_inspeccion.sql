create table if not exists public.evidencias_inspeccion (
  id uuid primary key default gen_random_uuid(),
  inspeccion_id uuid not null references public.inspecciones(id) on delete cascade,
  sub_item_id uuid not null references public.sub_items(id) on delete restrict,
  storage_path text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists evidencias_inspeccion_insp_idx on public.evidencias_inspeccion(inspeccion_id);
create index if not exists evidencias_inspeccion_sub_idx on public.evidencias_inspeccion(sub_item_id);

alter table public.evidencias_inspeccion enable row level security;

create policy "evidencias_insp_select_own" on public.evidencias_inspeccion for select
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.user_id = auth.uid()));

create policy "evidencias_insp_insert_own" on public.evidencias_inspeccion for insert
  with check (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.user_id = auth.uid() and i.estado = 'borrador'));

create policy "evidencias_insp_delete_own" on public.evidencias_inspeccion for delete
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.user_id = auth.uid() and i.estado = 'borrador'));

create or replace function public.enforce_max_evidencias()
returns trigger
language plpgsql
as $$
begin
  if (select count(1) from public.evidencias_inspeccion e where e.inspeccion_id = new.inspeccion_id and e.sub_item_id = new.sub_item_id) >= 4 then
    raise exception 'Máximo 4 fotos de evidencia por ítem';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_max_evidencias on public.evidencias_inspeccion;
create trigger trg_enforce_max_evidencias
  before insert on public.evidencias_inspeccion
  for each row execute function public.enforce_max_evidencias();
