-- Migración: Agregar rol 'both' (Administrador + Participante)
-- Ejecutar en Supabase SQL Editor

-- 1. Actualizar CHECK constraint en profiles.role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'participant', 'both'));

-- 2. Actualizar RLS en tabla areas
DROP POLICY IF EXISTS "Admins can insert areas" ON areas;
DROP POLICY IF EXISTS "Admins can update areas" ON areas;
DROP POLICY IF EXISTS "Admins can delete areas" ON areas;

CREATE POLICY "Admins can insert areas" ON areas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'both')));
CREATE POLICY "Admins can update areas" ON areas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'both')));
CREATE POLICY "Admins can delete areas" ON areas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'both')));

-- 3. Actualizar RLS en tabla evaluation_participants
DROP POLICY IF EXISTS "Admins can insert assignments" ON evaluation_participants;
DROP POLICY IF EXISTS "Admins can delete assignments" ON evaluation_participants;

CREATE POLICY "Admins can insert assignments" ON evaluation_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'both')));
CREATE POLICY "Admins can delete assignments" ON evaluation_participants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'both')));

-- 4. Actualizar RLS en tabla evaluations (si existen políticas de admin)
-- Nota: ejecutar solo si las políticas existen con esos nombres exactos
DO $$
BEGIN
  -- INSERT
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evaluations' AND policyname = 'Admins can insert evaluations') THEN
    DROP POLICY "Admins can insert evaluations" ON evaluations;
    CREATE POLICY "Admins can insert evaluations" ON evaluations FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'both')));
  END IF;
  -- UPDATE
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evaluations' AND policyname = 'Admins can update evaluations') THEN
    DROP POLICY "Admins can update evaluations" ON evaluations;
    CREATE POLICY "Admins can update evaluations" ON evaluations FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'both')));
  END IF;
  -- DELETE
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evaluations' AND policyname = 'Admins can delete evaluations') THEN
    DROP POLICY "Admins can delete evaluations" ON evaluations;
    CREATE POLICY "Admins can delete evaluations" ON evaluations FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'both')));
  END IF;
END $$;
