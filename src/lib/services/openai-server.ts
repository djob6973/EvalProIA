import { createServerFn } from '@tanstack/react-start';
import OpenAI from 'openai';

export type QuestionType = "seleccion_unica" | "seleccion_multiple" | "verdadero_falso";

export type GeneratedQuestion = {
  id: number;
  tipo: QuestionType;
  pregunta: string;
  contexto: string;
  opciones: string[];
  respuesta_correcta: number[];
  justificacion: string;
  dificultad: string;
  categoria: string;
};

export async function generateQuestionsServer(
  extractedText: string,
  numPreguntas: number,
  dificultad: string,
  categoria: string,
  distribucion: Record<QuestionType, number>,
  customSystemPrompt?: string,
  model = "gpt-4o-mini",
  temperature = 0.3,
  maxTokens = 4096
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno del servidor');
  }

  const openai = new OpenAI({ apiKey });
  
  const prompt = `Eres un experto diseñador de evaluaciones. Genera ${numPreguntas} preguntas de evaluación basadas en el siguiente texto.

Parámetros:
- Dificultad: ${dificultad}
- Categoría: ${categoria || 'General'}
- Distribución por tipo:
  * Selección única: ${distribucion.seleccion_unica}%
  * Selección múltiple: ${distribucion.seleccion_multiple}%
  * Verdadero/Falso: ${distribucion.verdadero_falso}%

Texto del documento:
${extractedText}

Genera un JSON válido con el siguiente formato exacto:
{
  "questions": [
    {
      "id": 1,
      "tipo": "seleccion_unica|seleccion_multiple|verdadero_falso",
      "pregunta": "enunciado completo de la pregunta",
      "contexto": "fragmento del documento que sustenta la pregunta",
      "opciones": ["opción A", "opción B", "opción C", "opción D"],
      "respuesta_correcta": [0],
      "justificacion": "explicación de por qué esa opción es correcta",
      "dificultad": "${dificultad}",
      "categoria": "${categoria || 'General'}"
    }
  ]
}

REGLAS OBLIGATORIAS — incumplirlas invalida la pregunta:
- Devuelve exactamente ${numPreguntas} preguntas.
- Todos los campos son requeridos; nunca los omitas ni los dejes vacíos.
- "pregunta" y "justificacion" deben tener al menos 10 caracteres cada uno.
- "contexto" debe citar el fragmento relevante del documento que origina la pregunta.
- "opciones" debe tener exactamente 4 elementos para seleccion_unica y seleccion_multiple, y exactamente 2 para verdadero_falso.
- "respuesta_correcta" contiene los índices base-0 de las opciones correctas dentro del array "opciones"; debe tener al menos un elemento válido.
- El JSON no debe contener comentarios ni texto fuera del objeto raíz.
Mantén precisión pedagógica y calibra la dificultad al nivel solicitado.`;

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: customSystemPrompt ?? 'Eres un experto en diseño de evaluaciones educativas. Siempre responde con JSON válido.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No se recibió respuesta de OpenAI');
  }

  const parsed = JSON.parse(content);
  const raw: unknown[] = Array.isArray(parsed.questions) ? parsed.questions : [];
  const questions = raw
    .map((q, i) => normalizeQuestion(q, i))
    .filter((q): q is GeneratedQuestion => q !== null);
  return questions;
}

function normalizeQuestion(q: unknown, index: number): GeneratedQuestion | null {
  if (!q || typeof q !== 'object') return null;
  const obj = q as Record<string, unknown>;

  const pregunta = typeof obj.pregunta === 'string' ? obj.pregunta.trim() : '';
  if (!pregunta) return null;

  const opciones = Array.isArray(obj.opciones)
    ? (obj.opciones as unknown[]).filter((o): o is string => typeof o === 'string' && o.trim() !== '')
    : [];
  if (opciones.length < 2) return null;

  const respuesta_correcta = Array.isArray(obj.respuesta_correcta)
    ? (obj.respuesta_correcta as unknown[]).filter((r): r is number => typeof r === 'number')
    : [];
  if (respuesta_correcta.length === 0) return null;

  return {
    id: typeof obj.id === 'number' ? obj.id : index + 1,
    tipo: (obj.tipo as GeneratedQuestion['tipo']) || 'seleccion_unica',
    pregunta,
    contexto: typeof obj.contexto === 'string' ? obj.contexto : '',
    opciones,
    respuesta_correcta,
    justificacion: typeof obj.justificacion === 'string' ? obj.justificacion : '',
    dificultad: typeof obj.dificultad === 'string' ? obj.dificultad : 'medio',
    categoria: typeof obj.categoria === 'string' ? obj.categoria : 'General',
  };
}

type GenerateQuestionsInput = {
  extractedText: string;
  numPreguntas: number;
  dificultad: string;
  categoria: string;
  distribucion: Record<string, number>;
  customSystemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export const generateQuestionsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateQuestionsInput) => data)
  .handler(async ({ data }) => {
    return generateQuestionsServer(
      data.extractedText,
      data.numPreguntas,
      data.dificultad,
      data.categoria,
      data.distribucion as Record<QuestionType, number>,
      data.customSystemPrompt,
      data.model,
      data.temperature,
      data.maxTokens
    );
  });

type ExtractImageTextInput = {
  base64: string;
};

export const extractImageTextFn = createServerFn({ method: 'POST' })
  .inputValidator((data: ExtractImageTextInput) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está configurada en el servidor');
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extrae únicamente el contenido textual de este documento. No incluyas explicaciones, formato adicional, ni comentarios. Solo devuelve el texto puro que identifiques en el documento.',
            },
            {
              type: 'image_url',
              image_url: { url: data.base64 },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No se recibió contenido de OpenAI');
    return content;
  });
