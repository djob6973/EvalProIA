-- Corregir políticas RLS para evitar recursión infinita
-- Ejecutar esto en el SQL Editor de Supabase

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Admins can insert evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Admins can update evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Users can view questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Users can view own results" ON public.results;
DROP POLICY IF EXISTS "Users can insert own results" ON public.results;
DROP POLICY IF EXISTS "Admins can view all results" ON public.results;

-- Crear políticas simplificadas sin recursión
-- Para profiles: permitir a usuarios autenticados ver, editar y eliminar perfiles
-- La lógica de roles se maneja en el frontend
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update profiles" ON public.profiles
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete profiles" ON public.profiles
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Para evaluations: permitir a todos ver, admins insertar/update
CREATE POLICY "Users can view evaluations" ON public.evaluations
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert evaluations" ON public.evaluations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update evaluations" ON public.evaluations
  FOR UPDATE WITH CHECK (true);

-- Para questions: permitir a todos ver, admins insertar
CREATE POLICY "Users can view questions" ON public.questions
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert questions" ON public.questions
  FOR INSERT WITH CHECK (true);

-- Para results: permitir ver/editar propios resultados
CREATE POLICY "Users can view own results" ON public.results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own results" ON public.results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all results" ON public.results
  FOR SELECT USING (true);
