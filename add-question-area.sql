-- Agregar campo area (área temática de la pregunta, para agrupar preguntas generadas)
-- Nota: esta columna también se crea automáticamente al iniciar el servidor (ver src/lib/migrate.ts).
-- Este archivo queda como referencia/ejecución manual opcional en Supabase SQL Editor.
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS area TEXT DEFAULT NULL;
