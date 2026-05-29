-- Migración: Asignaciones directas de participantes a evaluaciones
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS evaluation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(evaluation_id, user_id)
);

ALTER TABLE evaluation_participants ENABLE ROW LEVEL SECURITY;

-- Participantes ven sus propias asignaciones; admins ven todas
CREATE POLICY "Participants view own assignments, admins view all"
  ON evaluation_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert assignments"
  ON evaluation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete assignments"
  ON evaluation_participants FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_eval_participants_eval_id ON evaluation_participants(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_eval_participants_user_id ON evaluation_participants(user_id);
