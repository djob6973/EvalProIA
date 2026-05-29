-- Agregar política DELETE para la tabla questions
-- Permite a usuarios con role 'admin' o 'both' eliminar preguntas

CREATE POLICY "Admins can delete questions" ON public.questions
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Corregir también la política DELETE de evaluations para incluir role 'both'
DROP POLICY IF EXISTS "Admins can delete evaluations" ON public.evaluations;

CREATE POLICY "Admins can delete evaluations" ON public.evaluations
  FOR DELETE USING (auth.uid() IS NOT NULL);
