-- Tabla para almacenar el progreso de evaluaciones (para reanudar)
CREATE TABLE public.evaluation_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  evaluation_id UUID REFERENCES public.evaluations(id) ON DELETE CASCADE NOT NULL,
  current_question_index INTEGER DEFAULT 0 NOT NULL,
  answers JSONB DEFAULT '{}' NOT NULL,
  time_remaining INTEGER NOT NULL, -- Tiempo restante en segundos
  started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, evaluation_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_evaluation_progress_user_id ON public.evaluation_progress(user_id);
CREATE INDEX idx_evaluation_progress_evaluation_id ON public.evaluation_progress(evaluation_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER handle_evaluation_progress_updated_at BEFORE UPDATE ON public.evaluation_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security (RLS)
ALTER TABLE public.evaluation_progress ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver su propio progreso
CREATE POLICY "Users can view own progress" ON public.evaluation_progress
  FOR SELECT USING (auth.uid() = user_id);

-- Política: Los usuarios pueden insertar su propio progreso
CREATE POLICY "Users can insert own progress" ON public.evaluation_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden actualizar su propio progreso
CREATE POLICY "Users can update own progress" ON public.evaluation_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Política: Los usuarios pueden eliminar su propio progreso
CREATE POLICY "Users can delete own progress" ON public.evaluation_progress
  FOR DELETE USING (auth.uid() = user_id);

-- Política: Los admins pueden ver todo el progreso
CREATE POLICY "Admins can view all progress" ON public.evaluation_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
