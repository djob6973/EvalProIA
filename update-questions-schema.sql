-- Agregar campos adicionales a la tabla questions para soportar el banco de preguntas completo

-- Agregar campo contexto (contexto de la pregunta)
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS contexto TEXT DEFAULT '';

-- Agregar campo categoria (categoría de la pregunta)
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'General';

-- Agregar campo dificultad (dificultad de la pregunta)
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS dificultad TEXT CHECK (dificultad IN ('facil', 'medio', 'dificil')) DEFAULT 'medio';

-- Agregar campo estado (estado de la pregunta)
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS estado TEXT CHECK (estado IN ('activa', 'borrador')) DEFAULT 'activa';

-- Agregar campo justificacion (justificación de la respuesta correcta)
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS justificacion TEXT DEFAULT '';

-- Actualizar datos existentes si es necesario
UPDATE public.questions 
SET 
    contexto = '',
    categoria = 'General',
    dificultad = 'medio',
    estado = 'activa',
    justificacion = ''
WHERE contexto IS NULL OR categoria IS NULL;
