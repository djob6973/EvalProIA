-- Add fecha_vencimiento column to evaluations table
ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMPTZ DEFAULT NULL;

-- Comment explaining the column
COMMENT ON COLUMN evaluations.fecha_vencimiento IS
  'Optional expiration date/time. When set and current time exceeds this value, the evaluation is treated as inactive for all participants.';
