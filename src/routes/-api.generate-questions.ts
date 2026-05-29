import { createAPIFileRoute } from '@tanstack/react-router';
import { generateQuestionsServer } from '@/lib/services/openai-server';

export const APIRoute = createAPIFileRoute('/api/generate-questions')({
  methods: ['POST'],
  async handler(req) {
    try {
      const input = await req.json() as {
        extractedText: string;
        numPreguntas: number;
        dificultad: string;
        categoria: string;
        distribucion: Record<string, number>;
      };

      console.log('[API] POST /api/generate-questions');
      console.log('[API] Input:', {
        textLength: input.extractedText.length,
        numPreguntas: input.numPreguntas,
        dificultad: input.dificultad,
      });

      const result = await generateQuestionsServer(
        input.extractedText,
        input.numPreguntas,
        input.dificultad,
        input.categoria,
        input.distribucion
      );

      console.log('[API] Resultado:', result.length, 'preguntas');
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[API] Error:', error);
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
});
