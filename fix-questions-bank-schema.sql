-- Modificar la tabla questions para permitir preguntas sin evaluación (banco de preguntas)
-- Esto permite que las preguntas del banco de preguntas no necesiten estar asociadas a una evaluación específica

-- Hacer evaluation_id nullable para permitir preguntas del banco de preguntas
ALTER TABLE public.questions 
ALTER COLUMN evaluation_id DROP NOT NULL;

-- Eliminar políticas existentes si existen (para evitar errores)
DROP POLICY IF EXISTS "Admins can update questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can delete questions" ON public.questions;

-- Agregar política RLS para permitir que admins actualicen preguntas
CREATE POLICY "Admins can update questions" ON public.questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Agregar política RLS para permitir que admins eliminen preguntas
CREATE POLICY "Admins can delete questions" ON public.questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
