-- Actualizar CHECK constraints de puntajes de 4 a 5 niveles (agregar 50)
-- Tabla: detalles_inspeccion

alter table public.detalles_inspeccion drop constraint if exists detalles_inspeccion_s1_puntaje_check;
alter table public.detalles_inspeccion add constraint detalles_inspeccion_s1_puntaje_check check (s1_puntaje in (0,25,50,75,100));

alter table public.detalles_inspeccion drop constraint if exists detalles_inspeccion_s2_puntaje_check;
alter table public.detalles_inspeccion add constraint detalles_inspeccion_s2_puntaje_check check (s2_puntaje in (0,25,50,75,100));

alter table public.detalles_inspeccion drop constraint if exists detalles_inspeccion_s3_puntaje_check;
alter table public.detalles_inspeccion add constraint detalles_inspeccion_s3_puntaje_check check (s3_puntaje in (0,25,50,75,100));

alter table public.detalles_inspeccion drop constraint if exists detalles_inspeccion_s4_puntaje_check;
alter table public.detalles_inspeccion add constraint detalles_inspeccion_s4_puntaje_check check (s4_puntaje in (0,25,50,75,100));

alter table public.detalles_inspeccion drop constraint if exists detalles_inspeccion_s5_puntaje_check;
alter table public.detalles_inspeccion add constraint detalles_inspeccion_s5_puntaje_check check (s5_puntaje in (0,25,50,75,100));

-- Tabla: detalles_publicos

alter table public.detalles_publicos drop constraint if exists detalles_publicos_s1_puntaje_check;
alter table public.detalles_publicos add constraint detalles_publicos_s1_puntaje_check check (s1_puntaje in (0,25,50,75,100));

alter table public.detalles_publicos drop constraint if exists detalles_publicos_s2_puntaje_check;
alter table public.detalles_publicos add constraint detalles_publicos_s2_puntaje_check check (s2_puntaje in (0,25,50,75,100));

alter table public.detalles_publicos drop constraint if exists detalles_publicos_s3_puntaje_check;
alter table public.detalles_publicos add constraint detalles_publicos_s3_puntaje_check check (s3_puntaje in (0,25,50,75,100));

alter table public.detalles_publicos drop constraint if exists detalles_publicos_s4_puntaje_check;
alter table public.detalles_publicos add constraint detalles_publicos_s4_puntaje_check check (s4_puntaje in (0,25,50,75,100));

alter table public.detalles_publicos drop constraint if exists detalles_publicos_s5_puntaje_check;
alter table public.detalles_publicos add constraint detalles_publicos_s5_puntaje_check check (s5_puntaje in (0,25,50,75,100));
