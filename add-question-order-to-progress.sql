-- Agregar campo question_order para guardar el orden de las preguntas
ALTER TABLE public.evaluation_progress 
ADD COLUMN question_order JSONB DEFAULT '[]' NOT NULL;
