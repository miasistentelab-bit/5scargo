
-- Fix function search_path
create or replace function public.bloquear_inspeccion_finalizada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.estado = 'finalizada' then
    raise exception 'No se puede modificar una inspección finalizada (integridad de auditoría)';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

-- Replace overly-permissive policies on sectores/sub_items with explicit per-action policies
drop policy if exists "sectores_all_auth" on public.sectores;
create policy "sectores_insert_auth" on public.sectores for insert to authenticated with check (auth.uid() is not null);
create policy "sectores_update_auth" on public.sectores for update to authenticated using (auth.uid() is not null);
create policy "sectores_delete_auth" on public.sectores for delete to authenticated using (auth.uid() is not null);

drop policy if exists "sub_items_all_auth" on public.sub_items;
create policy "sub_items_insert_auth" on public.sub_items for insert to authenticated with check (auth.uid() is not null);
create policy "sub_items_update_auth" on public.sub_items for update to authenticated using (auth.uid() is not null);
create policy "sub_items_delete_auth" on public.sub_items for delete to authenticated using (auth.uid() is not null);

-- Make evidencias bucket private + restrict listing to authenticated users
update storage.buckets set public = false where id = 'evidencias';

drop policy if exists "evidencias_select_public" on storage.objects;
create policy "evidencias_select_auth" on storage.objects for select to authenticated
  using (bucket_id = 'evidencias');
