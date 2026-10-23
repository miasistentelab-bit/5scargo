create table if not exists public.sub_item_maestras (
  id uuid primary key default gen_random_uuid(),
  sub_item_id uuid not null references public.sub_items(id) on delete cascade,
  storage_path text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists sub_item_maestras_sub_item_idx on public.sub_item_maestras(sub_item_id);

alter table public.sub_item_maestras enable row level security;

create policy "sub_item_maestras_select_auth" on public.sub_item_maestras
for select to authenticated
using (true);

create policy "sub_item_maestras_insert_auth" on public.sub_item_maestras
for insert to authenticated
with check (auth.uid() is not null);

create policy "sub_item_maestras_update_auth" on public.sub_item_maestras
for update to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy "sub_item_maestras_delete_auth" on public.sub_item_maestras
for delete to authenticated
using (auth.uid() is not null);

create or replace function public.enforce_max_maestras()
returns trigger
language plpgsql
as $$
begin
  if (select count(1) from public.sub_item_maestras m where m.sub_item_id = new.sub_item_id) >= 4 then
    raise exception 'Máximo 4 fotos originales por ítem';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_max_maestras on public.sub_item_maestras;
create trigger trg_enforce_max_maestras
  before insert on public.sub_item_maestras
  for each row execute function public.enforce_max_maestras();
