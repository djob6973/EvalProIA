-- Migración: Soporte multiárea
-- Ejecutar en Supabase SQL Editor

-- 1. Tabla areas
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. RLS para areas
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view areas"
  ON areas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert areas"
  ON areas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update areas"
  ON areas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete areas"
  ON areas FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Columna area_id en evaluations
ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;

-- 4. Columna area_id en profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_evaluations_area_id ON evaluations(area_id);
CREATE INDEX IF NOT EXISTS idx_profiles_area_id ON profiles(area_id);
