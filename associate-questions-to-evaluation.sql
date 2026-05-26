-- Asociar todas las preguntas sin evaluación a la evaluación específica
UPDATE public.questions
SET evaluation_id = '19be6598-1b0c-42a7-8d39-d06b1873a59f'
WHERE evaluation_id IS NULL;

-- Verificar que las preguntas ahora están asociadas
SELECT 
  e.id as evaluation_id,
  e.title as evaluation_title,
  COUNT(q.id) as question_count
FROM public.evaluations e
LEFT JOIN public.questions q ON e.id = q.evaluation_id
WHERE e.id = '19be6598-1b0c-42a7-8d39-d06b1873a59f'
GROUP BY e.id, e.title;
