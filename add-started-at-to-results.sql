-- Agregar campo started_at a la tabla results para calcular duración
ALTER TABLE public.results 
ADD COLUMN started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- Crear índice para mejorar rendimiento
CREATE INDEX idx_results_started_at ON public.results(started_at);
