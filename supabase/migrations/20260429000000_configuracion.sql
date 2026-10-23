CREATE TABLE IF NOT EXISTS public.configuracion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT UNIQUE NOT NULL,
    valor TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Permitir lectura pública de configuración" ON public.configuracion
    FOR SELECT USING (true);

-- Allow authenticated users to manage configuration
CREATE POLICY "Permitir gestión de configuración a usuarios autenticados" ON public.configuracion
    FOR ALL USING (auth.role() = 'authenticated');

-- Insert initial row for master plan if it doesn't exist
INSERT INTO public.configuracion (clave, valor)
VALUES ('master_plan_url', NULL)
ON CONFLICT (clave) DO NOTHING;
