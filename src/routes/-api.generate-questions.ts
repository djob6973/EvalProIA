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
        area: string;
        distribucion: Record<string, number>;
        customSystemPrompt?: string;
      };

      const result = await generateQuestionsServer(
        input.extractedText,
        input.numPreguntas,
        input.dificultad,
        input.categoria,
        input.area,
        input.distribucion,
        input.customSystemPrompt
      );
      
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
