-- Verificar preguntas asociadas a la evaluación
SELECT 
  e.id as evaluation_id,
  e.title as evaluation_title,
  COUNT(q.id) as question_count
FROM public.evaluations e
LEFT JOIN public.questions q ON e.id = q.evaluation_id
WHERE e.id = '19be6598-1b0c-42a7-8d39-d06b1873a59f'
GROUP BY e.id, e.title;

-- Verificar todas las preguntas en la base de datos
SELECT 
  id,
  evaluation_id,
  question_text,
  created_at
FROM public.questions
ORDER BY created_at DESC
LIMIT 10;

-- Verificar todas las evaluaciones
SELECT 
  id,
  title,
  activa,
  created_at
FROM public.evaluations
ORDER BY created_at DESC;
