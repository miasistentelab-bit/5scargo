-- Allow any authenticated user to insert/update/delete inspection details
-- as long as the inspection is in 'borrador' state
-- This matches the frontend change that allows any user to continue audits

drop policy if exists "detalles_select_own" on public.detalles_inspeccion;
drop policy if exists "detalles_insert_own" on public.detalles_inspeccion;
drop policy if exists "detalles_update_own" on public.detalles_inspeccion;
drop policy if exists "detalles_delete_own" on public.detalles_inspeccion;

create policy "detalles_select_auth" on public.detalles_inspeccion for select to authenticated
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.estado = 'borrador'));

create policy "detalles_insert_auth" on public.detalles_inspeccion for insert to authenticated
  with check (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.estado = 'borrador'));

create policy "detalles_update_auth" on public.detalles_inspeccion for update to authenticated
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.estado = 'borrador'));

create policy "detalles_delete_auth" on public.detalles_inspeccion for delete to authenticated
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.estado = 'borrador'));
