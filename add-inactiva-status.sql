-- Agregar estado 'inactiva' a la tabla questions
-- Esto permite tener tres estados: activa, borrador e inactiva

-- Modificar el CHECK constraint para incluir 'inactiva'
ALTER TABLE public.questions 
DROP CONSTRAINT IF EXISTS questions_estado_check;

ALTER TABLE public.questions 
ADD CONSTRAINT questions_estado_check 
CHECK (estado IN ('activa', 'borrador', 'inactiva'));
