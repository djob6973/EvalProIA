-- Agregar campos adicionales a la tabla evaluations para soportar la UI completa

-- Agregar campo tiempo_limite (tiempo límite en minutos, 0 = sin límite)
ALTER TABLE public.evaluations 
ADD COLUMN IF NOT EXISTS tiempo_limite INTEGER DEFAULT 0;

-- Agregar campo intentos_permitidos (número de intentos permitidos)
ALTER TABLE public.evaluations 
ADD COLUMN IF NOT EXISTS intentos_permitidos INTEGER DEFAULT 1;

-- Agregar campo activa (estado de la evaluación)
ALTER TABLE public.evaluations 
ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;

-- Agregar campo categorias (array de categorías)
ALTER TABLE public.evaluations 
ADD COLUMN IF NOT EXISTS categorias TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Agregar campo config (configuración JSONB para preguntas)
ALTER TABLE public.evaluations 
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{"num_preguntas": 20, "dificultad": "mixto", "dist_unica": 50, "dist_multiple": 30, "dist_vf": 20, "aleatorio": true}'::jsonb;

-- Actualizar datos existentes si es necesario
UPDATE public.evaluations 
SET 
    tiempo_limite = 60,
    intentos_permitidos = 2,
    activa = true,
    categorias = ARRAY['General'],
    config = '{"num_preguntas": 20, "dificultad": "mixto", "dist_unica": 50, "dist_multiple": 30, "dist_vf": 20, "aleatorio": true}'::jsonb
WHERE tiempo_limite IS NULL OR config IS NULL;
