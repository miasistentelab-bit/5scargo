-- Fix RLS policies for detalles_inspeccion to allow authenticated users to read all details
-- This ensures the Results page can display and export all inspection data

drop policy if exists "detalles_select_own" on public.detalles_inspeccion;
drop policy if exists "detalles_insert_own" on public.detalles_inspeccion;
drop policy if exists "detalles_update_own" on public.detalles_inspeccion;
drop policy if exists "detalles_delete_own" on public.detalles_inspeccion;
drop policy if exists "detalles_select_auth" on public.detalles_inspeccion;
drop policy if exists "detalles_insert_auth" on public.detalles_inspeccion;
drop policy if exists "detalles_update_auth" on public.detalles_inspeccion;
drop policy if exists "detalles_delete_auth" on public.detalles_inspeccion;

-- Authenticated users can read all details (needed for reports and export)
create policy "detalles_select_all_auth" on public.detalles_inspeccion for select to authenticated using (true);

-- Authenticated users can insert/update/delete details for inspections in 'borrador' state
create policy "detalles_insert_borrador" on public.detalles_inspeccion for insert to authenticated
  with check (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.estado = 'borrador'));

create policy "detalles_update_borrador" on public.detalles_inspeccion for update to authenticated
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.estado = 'borrador'));

create policy "detalles_delete_borrador" on public.detalles_inspeccion for delete to authenticated
  using (exists (select 1 from public.inspecciones i where i.id = inspeccion_id and i.estado = 'borrador'));
