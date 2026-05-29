-- =============================================================================
-- FIX RLS SECURITY — Ejecutar en Supabase SQL Editor
-- Corrige políticas permisivas (WITH CHECK (true) / auth.uid() IS NOT NULL)
-- introducidas en fix-rls-policies.sql y add-delete-policy-questions.sql.
--
-- Estrategia: función SECURITY DEFINER is_admin() que consulta profiles
-- sin activar RLS, evitando la recursión infinita original.
-- También unifica la verificación de roles 'admin' y 'both'.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Función helper — bypasea RLS para leer el rol del usuario actual
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'both')
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. profiles — corregir UPDATE (solo propio) y DELETE (solo admin)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile"           ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete any profile"           ON public.profiles;

-- Cualquier usuario puede actualizar solo su propio perfil
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Solo admins pueden actualizar cualquier perfil (ej. cambiar rol)
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE
  USING (public.is_admin());

-- Solo admins pueden eliminar perfiles
CREATE POLICY "Admins can delete any profile" ON public.profiles
  FOR DELETE
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3. evaluations — INSERT y UPDATE solo para admins
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can insert evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Admins can update evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Admins can delete evaluations" ON public.evaluations;

CREATE POLICY "Admins can insert evaluations" ON public.evaluations
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update evaluations" ON public.evaluations
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete evaluations" ON public.evaluations
  FOR DELETE
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. questions — INSERT y DELETE solo para admins
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can delete questions"  ON public.questions;

CREATE POLICY "Admins can insert questions" ON public.questions
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete questions" ON public.questions
  FOR DELETE
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 5. areas — actualizar políticas para incluir rol 'both'
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can insert areas" ON public.areas;
DROP POLICY IF EXISTS "Admins can update areas" ON public.areas;
DROP POLICY IF EXISTS "Admins can delete areas" ON public.areas;

CREATE POLICY "Admins can insert areas" ON public.areas
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update areas" ON public.areas
  FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete areas" ON public.areas
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. evaluation_participants — actualizar políticas para incluir rol 'both'
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants view own assignments, admins view all" ON public.evaluation_participants;
DROP POLICY IF EXISTS "Admins can insert assignments"                       ON public.evaluation_participants;
DROP POLICY IF EXISTS "Admins can delete assignments"                       ON public.evaluation_participants;

CREATE POLICY "Participants view own assignments, admins view all"
  ON public.evaluation_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can insert assignments"
  ON public.evaluation_participants FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete assignments"
  ON public.evaluation_participants FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 7. evaluation_progress — admin view para incluir rol 'both'
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all progress" ON public.evaluation_progress;

CREATE POLICY "Admins can view all progress" ON public.evaluation_progress
  FOR SELECT
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 8. results — admin view para incluir rol 'both'
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all results" ON public.results;

CREATE POLICY "Admins can view all results" ON public.results
  FOR SELECT
  USING (public.is_admin());
