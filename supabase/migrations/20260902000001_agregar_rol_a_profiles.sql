-- Agregar campo rol a la tabla profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'usuario';

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Crear función auxiliar para verificar si es admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol = 'admin' FROM public.profiles WHERE id = auth.uid();
$$;

-- Crear nuevas políticas
CREATE POLICY "profiles_select_own_with_rol" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_insert_own_with_rol" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own_with_rol" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Actualizar el trigger para incluir el rol
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, rol)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'usuario')
  );
  RETURN new;
END;
$$;

-- Establecer al primer usuario como admin (opcional - para desarrollo)
-- UPDATE public.profiles SET rol = 'admin' WHERE id = (SELECT MIN(id) FROM public.profiles);
