-- Add DELETE policy for evaluations table
-- This allows admins to delete evaluations

CREATE POLICY "Admins can delete evaluations" ON public.evaluations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
