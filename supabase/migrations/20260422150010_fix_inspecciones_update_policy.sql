drop policy if exists "inspecciones_update_own" on public.inspecciones;

create policy "inspecciones_update_own" on public.inspecciones
for update to authenticated
using (auth.uid() = user_id and estado = 'borrador')
with check (auth.uid() = user_id);
