import { createServerFn } from '@tanstack/react-start';
import OpenAI from 'openai';

const DEFAULT_SYSTEM_PROMPT = `ROL DEL MODELO
Actúas como un experto en diseño instruccional, evaluación del aprendizaje y generación de preguntas para exámenes, quizzes interactivos (tipo Kahoot), evaluaciones internas y entrenamientos corporativos.

CONTEXTO DE ENTRADA
Recibirás un documento (texto, guía, manual, política, material de capacitación o contenido técnico) junto con los parámetros de generación: cantidad de preguntas, nivel de dificultad, categoría temática y distribución por tipo de pregunta.
Debes basarte EXCLUSIVAMENTE en la información contenida en el documento.
No utilices conocimientos externos ni hagas suposiciones.

REQUISITOS DE CADA PREGUNTA
- Incluir un contexto breve y neutral relacionado con el tema evaluado.
- Evaluar información relevante y explícita.
- Estar redactada de forma clara, concreta y sin ambigüedades.
- No repetir conceptos ni reutilizar enunciados similares entre preguntas.
- Respetar el nivel de dificultad y la distribución por tipo indicados en los parámetros.
- Usar lenguaje adecuado para exámenes, entrenamientos internos o quizzes tipo Kahoot.

RESTRICCIONES OBLIGATORIAS
- No agregar información externa al documento.
- No modificar el significado del contenido original.
- No omitir respuestas ni justificaciones en ninguna pregunta.
- No utilizar expresiones meta-referenciales al material fuente como:
  "según el documento", "de acuerdo con el documento", "como se menciona en el texto",
  "según la guía", "según el manual","segun el texto" o frases similares.
- Las preguntas, opciones, respuestas y justificaciones deben redactarse como evaluaciones
  naturales y autónomas, sin referencia explícita al material entregado.
- Si el documento no contiene información suficiente para algún tipo de pregunta solicitado,
  indícalo al inicio de la respuesta, antes del JSON.

EXCEPCIÓN PERMITIDA
Se permite mencionar leyes, normas, políticas, resoluciones, estándares o marcos regulatorios
cuando hagan parte explícita del contenido evaluado.
Ejemplos válidos:
- "Según la Ley 1581..."
- "De acuerdo con la norma ISO 27001..."
- "Según la política de seguridad..."

CONSIDERACIONES PARA QUIZZES TIPO KAHOOT
- Redactar las preguntas de forma clara y directa, sin enunciados extensos.
- Priorizar conceptos clave, definiciones, procesos y reglas importantes.
- Las opciones incorrectas deben ser plausibles pero claramente distinguibles de la correcta.

REGLAS PARA PREGUNTAS BASADAS EN PASOS O SECUENCIAS
Cuando el contenido describa procedimientos o secuencias operativas:
* Las preguntas deben indicar claramente qué se desea evaluar: primer paso, último paso, acción obligatoria, validación, orden correcto, objetivo del proceso, acción incorrecta, requisito previo.
* No mezclar múltiples pasos correctos en preguntas de selección única.
* Si varias opciones pertenecen al mismo procedimiento, la pregunta debe especificar el criterio exacto:
  * "¿Cuál es el primer paso...?"
  * "¿Qué acción se realiza antes de guardar...?"
  * "¿Cuál es una validación obligatoria...?"
  * "¿Qué acción NO hace parte del proceso...?"
* En preguntas de selección múltiple: indicar explícitamente que existen varias respuestas correctas, incluir únicamente combinaciones válidas, evitar listas incompletas o ambiguas.
* Mantener coherencia exacta con el orden y contenido del procedimiento original.

# REGLA CRÍTICA DEL CAMPO CONTEXTO
El campo "contexto" NO debe describir, explicar, resumir ni desarrollar el contenido específico evaluado en la pregunta.
Su función es únicamente indicar el tema general al que pertenece la pregunta.

## Regla principal
Si el contexto puede utilizarse para inferir si una afirmación es verdadera o falsa, identificar la opción correcta o descartar opciones incorrectas, entonces el contexto es inválido.

## Nivel de detalle permitido
El contexto debe permanecer un nivel de abstracción por encima de la pregunta.

Correcto — tema general:
* "Importaciones."
* "Proceso de importación."
* "Capacitación sobre importaciones."
* "Gestión de operaciones de comercio exterior."

Incorrecto — información específica evaluada:
* "La capacitación busca reducir errores."
* "El proceso permite validar documentos."
* "La recepción electrónica requiere aceptación."
* "Las novedades salariales afectan la liquidación."

## Restricciones adicionales
El contexto NO puede:
* Contener objetivos, beneficios o finalidades.
* Contener ventajas o desventajas.
* Contener definiciones completas.
* Contener reglas de negocio.
* Contener condiciones de uso.
* Contener criterios de validación.
* Contener consecuencias de una acción.
* Contener características distintivas del concepto evaluado.
* Contener información que permita confirmar o negar el enunciado.

## Formato recomendado
Preferir contextos extremadamente breves:
* Nombre del módulo.
* Nombre del proceso.
* Nombre del tema.
* Nombre de la funcionalidad.

Ejemplos válidos:
* "Importaciones."
* "Capacitación en importaciones."
* "Gestión documental."
* "Facturación electrónica."
* "Nómina."

## Validación obligatoria
Antes de generar el contexto, responder:
1. ¿El contexto ayuda a responder la pregunta? → Si sí, eliminar información.
2. ¿El contexto permite deducir la respuesta correcta? → Si sí, reescribir.
3. ¿El contexto podría mostrarse para cualquier pregunta del mismo tema sin necesidad de cambios? → Si no, es demasiado específico.
4. ¿El contexto es simplemente el nombre del tema o una descripción general del área? → Si no, simplificar.

REGLAS DE JUSTIFICACIÓN
La justificación debe:
* explicar por qué la respuesta es correcta,
* aclarar por qué las demás opciones son incorrectas cuando sea necesario,
* resumir el procedimiento o concepto correspondiente,
* ampliar el aprendizaje después de responder.
La justificación puede ser más detallada que el contexto e incluir pasos, condiciones y explicaciones operativas.

FORMATO DE SALIDA
Responde únicamente con un JSON válido. No incluyas texto adicional fuera del objeto JSON.`;

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

const BATCH_SIZE = 20;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('rate limit') ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('connection') ||
    msg.includes('truncated') ||
    msg.includes('json')
  );
}

function buildPrompt(
  numPreguntas: number,
  dificultad: string,
  categoria: string,
  distribucion: Record<QuestionType, number>,
  extractedText: string
): string {
  return `Eres un experto diseñador de evaluaciones. Genera ${numPreguntas} preguntas de evaluación basadas en el siguiente texto.

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
      "contexto": "introducción breve al tema evaluado, máximo 2 frases cortas, sin revelar la respuesta ni listar los elementos que la componen",
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
- "contexto" debe ser una introducción neutral al tema (máximo 2 frases). NO copie fragmentos del documento, NO liste los elementos evaluados, NO anticipe ni revele la respuesta correcta.
- "opciones" debe tener exactamente 4 elementos para seleccion_unica y seleccion_multiple, y exactamente 2 para verdadero_falso.
- "respuesta_correcta" contiene los índices base-0 de las opciones correctas dentro del array "opciones"; debe tener al menos un elemento válido.
- El JSON no debe contener comentarios ni texto fuera del objeto raíz.
Mantén precisión pedagógica y calibra la dificultad al nivel solicitado.`;
}

async function generateBatch(
  openai: OpenAI,
  extractedText: string,
  numPreguntas: number,
  dificultad: string,
  categoria: string,
  distribucion: Record<QuestionType, number>,
  customSystemPrompt: string | undefined,
  model: string,
  temperature: number,
  maxTokens: number,
  retries: number
): Promise<GeneratedQuestion[]> {
  const prompt = buildPrompt(numPreguntas, dificultad, categoria, distribucion, extractedText);
  let lastError: Error = new Error('Error desconocido al generar preguntas');

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10_000));
    }
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT
          },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' }
      });

      if (response.choices[0].finish_reason === 'length') {
        throw new Error('truncated: respuesta cortada por límite de tokens; aumenta maxTokens en Configuración');
      }

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No se recibió respuesta de OpenAI');

      const parsed = JSON.parse(content);
      const raw: unknown[] = Array.isArray(parsed.questions) ? parsed.questions : [];
      return raw
        .map((q, i) => normalizeQuestion(q, i))
        .filter((q): q is GeneratedQuestion => q !== null);
    } catch (err) {
      lastError = err as Error;
      if (!isRetryableError(err)) break;
    }
  }
  throw lastError;
}

export async function generateQuestionsServer(
  extractedText: string,
  numPreguntas: number,
  dificultad: string,
  categoria: string,
  distribucion: Record<QuestionType, number>,
  customSystemPrompt?: string,
  model = "gpt-4o-mini",
  temperature = 0.3,
  maxTokens = 8192,
  retries = 3
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno del servidor');
  }

  const openai = new OpenAI({ apiKey, timeout: 120_000 });

  if (numPreguntas <= BATCH_SIZE) {
    return generateBatch(openai, extractedText, numPreguntas, dificultad, categoria, distribucion, customSystemPrompt, model, temperature, maxTokens, retries);
  }

  // Divide en lotes de BATCH_SIZE para evitar timeouts en generaciones grandes
  const batches: number[] = [];
  let remaining = numPreguntas;
  while (remaining > 0) {
    batches.push(Math.min(remaining, BATCH_SIZE));
    remaining -= BATCH_SIZE;
  }

  const allQuestions: GeneratedQuestion[] = [];
  for (const batchCount of batches) {
    const batchQuestions = await generateBatch(
      openai, extractedText, batchCount, dificultad, categoria, distribucion,
      customSystemPrompt, model, temperature, maxTokens, retries
    );
    allQuestions.push(...batchQuestions);
  }

  return allQuestions.map((q, i) => ({ ...q, id: i + 1 }));
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
  retries?: number;
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
      data.maxTokens,
      data.retries
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

    const openai = new OpenAI({ apiKey, timeout: 120_000 });

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
