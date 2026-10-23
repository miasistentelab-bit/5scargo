drop policy if exists "inspecciones_insert_own" on public.inspecciones;
drop policy if exists "inspecciones_update_own" on public.inspecciones;

create policy "inspecciones_insert_own" on public.inspecciones
for insert to authenticated
with check (
  auth.uid() = user_id
  and (
    anio < extract(year from now())::int
    or (anio = extract(year from now())::int and mes <= extract(month from now())::int)
  )
);

create policy "inspecciones_update_own" on public.inspecciones
for update to authenticated
using (auth.uid() = user_id and estado = 'borrador')
with check (
  auth.uid() = user_id
  and (
    anio < extract(year from now())::int
    or (anio = extract(year from now())::int and mes <= extract(month from now())::int)
  )
);
