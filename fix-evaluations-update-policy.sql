-- Fix the UPDATE policy for evaluations table
-- The policy needs a USING clause to specify which rows can be updated

-- Drop the existing incomplete policy
DROP POLICY IF EXISTS "Admins can update evaluations" ON public.evaluations;

-- Create the corrected policy with both USING and WITH CHECK clauses
CREATE POLICY "Admins can update evaluations" ON public.evaluations
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (true);
