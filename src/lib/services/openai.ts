import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_OPENAI_API_KEY no está configurada. Por favor, agrega tu API key de OpenAI al archivo .env');
  }
  
  return new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });
}

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

export async function extractTextFromFile(file: File): Promise<string> {
  try {
    // For text files, read directly
    if (file.type === 'text/plain') {
      return await file.text();
    }

    // For PDF and DOCX, we need to use OpenAI vision API
    // This function should not be called for non-text files
    // Use extractTextWithOCR instead
    throw new Error('Tipo de archivo no soportado para extracción directa. Use extractTextWithOCR para PDF y DOCX.');
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error('No se pudo extraer el texto del archivo');
  }
}

export async function generateQuestions(
  extractedText: string,
  numPreguntas: number,
  dificultad: string,
  categoria: string,
  distribucion: Record<QuestionType, number>
): Promise<GeneratedQuestion[]> {
  try {
    const openai = getOpenAIClient();
    
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

Genera un JSON válido con el siguiente formato:
{
  "questions": [
    {
      "id": 1,
      "tipo": "seleccion_unica|seleccion_multiple|verdadero_falso",
      "pregunta": "texto de la pregunta",
      "contexto": "contexto relevante del documento",
      "opciones": ["opción A", "opción B", "opción C", "opción D"],
      "respuesta_correcta": [0], // índice(s) de la(s) respuesta(s) correcta(s)
      "justificacion": "explicación de por qué es correcta",
      "dificultad": "${dificultad}",
      "categoria": "${categoria || 'General'}"
    }
  ]
}

Mantén precisión pedagógica y calibra la dificultad al nivel solicitado.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en diseño de evaluaciones educativas. Siempre responde con JSON válido.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No se recibió respuesta de OpenAI');
    }

    const parsed = JSON.parse(content);
    return parsed.questions || [];
  } catch (error) {
    console.error('Error generating questions:', error);
    throw new Error('No se pudieron generar las preguntas. Por favor, verifica tu API key de OpenAI.');
  }
}

export async function extractTextWithOCR(file: File): Promise<string> {
  try {
    const openai = getOpenAIClient();
    
    // Convert file to base64 for vision API
    const base64 = await fileToBase64(file);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extrae únicamente el contenido textual de este documento. No incluyas explicaciones, formato adicional, ni comentarios. Solo devuelve el texto puro que identifiques en el documento.'
            },
            {
              type: 'image_url',
              image_url: {
                url: base64
              }
            }
          ]
        }
      ],
      max_tokens: 4096
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No se recibió contenido de OpenAI');
    }
    return content;
  } catch (error) {
    console.error('Error with OCR:', error);
    // For text files, try direct extraction
    if (file.type === 'text/plain') {
      return await file.text();
    }
    throw new Error('No se pudo extraer el texto del documento. Verifica tu API key de OpenAI.');
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = error => reject(error);
  });
}
