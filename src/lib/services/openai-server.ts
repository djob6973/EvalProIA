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
  area: string;
  /** Narrativa del caso práctico al que pertenece esta pregunta, si aplica. */
  escenario?: string;
  tipo_caso?: string;
  es_caso_practico?: boolean;
  /** Agrupa preguntas hermanas del mismo caso; se persiste al guardar. */
  caso_id?: string;
  /** Posición (0-based) de esta pregunta dentro de su caso; se calcula al guardar. */
  caso_orden?: number;
};

export type CaseType =
  | "Automático"
  | "Operativo"
  | "Atención al Cliente"
  | "Seguridad de la Información"
  | "Administrativo"
  | "Legal"
  | "Financiero"
  | "Comercial"
  | "Tecnológico";

export type CaseLength = "Corta" | "Media" | "Detallada";

export type CasosPracticosConfig = {
  habilitado: boolean;
  tipo: CaseType;
  longitud: CaseLength;
  preguntasPorCaso: number;
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
  area: string,
  distribucion: Record<QuestionType, number>,
  extractedText: string,
  idioma = "Español",
  previousQuestions: string[] = [],
  escenarioFijo?: string
): string {
  const previousQuestionsBlock = previousQuestions.length > 0
    ? `\nPREGUNTAS YA GENERADAS EN LOTES ANTERIORES (NO REPETIR)\nEstas preguntas ya fueron generadas para esta misma evaluación. NO generes preguntas iguales, ni reformulaciones del mismo enunciado, ni preguntas que evalúen exactamente el mismo punto específico del documento:\n${previousQuestions.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nGenera contenido NUEVO: explora otras secciones, detalles, procesos o matices del documento que aún no hayan sido evaluados por las preguntas anteriores.\n`
    : '';

  const escenarioFijoBlock = escenarioFijo
    ? `\nCASO PRÁCTICO YA DEFINIDO (no lo modifiques, no lo repitas ni lo resumas en el campo "contexto"; la(s) pregunta(s) deben evaluar la aplicación de este mismo escenario, sin inventar uno nuevo):\n${escenarioFijo}\n`
    : '';

  return `Eres un experto diseñador de evaluaciones. Genera ${numPreguntas} preguntas de evaluación basadas en el siguiente texto.

Parámetros:
- Idioma de salida: ${idioma} (TODAS las preguntas, opciones, contexto y justificaciones deben estar en ${idioma})
- Dificultad: ${dificultad}
- Categoría: ${categoria || 'General'}
- Área: ${area || 'General'}
- Distribución por tipo:
  * Selección única: ${distribucion.seleccion_unica}%
  * Selección múltiple: ${distribucion.seleccion_multiple}%
  * Verdadero/Falso: ${distribucion.verdadero_falso}%
${previousQuestionsBlock}${escenarioFijoBlock}
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
      "categoria": "${categoria || 'General'}",
      "area": "${area || 'General'}"
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
  area: string,
  distribucion: Record<QuestionType, number>,
  customSystemPrompt: string | undefined,
  model: string,
  temperature: number,
  maxTokens: number,
  retries: number,
  idioma = "Español",
  previousQuestions: string[] = [],
  escenarioFijo?: string
): Promise<GeneratedQuestion[]> {
  const prompt = buildPrompt(numPreguntas, dificultad, categoria, area, distribucion, extractedText, idioma, previousQuestions, escenarioFijo);
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

function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const MAX_DEDUPE_ATTEMPTS = 3;

// Genera `numPreguntas` preguntas nuevas evitando duplicar `previousQuestions`.
// Si el modelo repite alguna a pesar de la instrucción, reintenta solo el faltante
// (hasta MAX_DEDUPE_ATTEMPTS veces) en vez de aceptar duplicados o quedarse corto.
async function generateUniqueBatch(
  openai: OpenAI,
  extractedText: string,
  numPreguntas: number,
  dificultad: string,
  categoria: string,
  area: string,
  distribucion: Record<QuestionType, number>,
  customSystemPrompt: string | undefined,
  model: string,
  temperature: number,
  maxTokens: number,
  retries: number,
  idioma: string,
  previousQuestions: string[],
  escenarioFijo?: string
): Promise<GeneratedQuestion[]> {
  const seen = new Set(previousQuestions.map(normalizeQuestionText));
  const knownQuestions = [...previousQuestions];
  const accepted: GeneratedQuestion[] = [];

  for (let attempt = 0; attempt < MAX_DEDUPE_ATTEMPTS && accepted.length < numPreguntas; attempt++) {
    const stillNeeded = numPreguntas - accepted.length;
    // En reintentos, sube la temperatura para favorecer contenido distinto al ya generado
    const attemptTemperature = attempt === 0 ? temperature : Math.min(1, temperature + attempt * 0.15);
    const batch = await generateBatch(
      openai, extractedText, stillNeeded, dificultad, categoria, area, distribucion,
      customSystemPrompt, model, attemptTemperature, maxTokens, retries, idioma, knownQuestions, escenarioFijo
    );
    for (const q of batch) {
      const key = normalizeQuestionText(q.pregunta);
      if (seen.has(key)) continue;
      seen.add(key);
      knownQuestions.push(q.pregunta);
      accepted.push(q);
    }
  }

  return accepted;
}

export async function generateQuestionsServer(
  extractedText: string,
  numPreguntas: number,
  dificultad: string,
  categoria: string,
  area: string,
  distribucion: Record<QuestionType, number>,
  customSystemPrompt?: string,
  model = "gpt-4o-mini",
  temperature = 0.3,
  maxTokens = 8192,
  retries = 3,
  idioma = "Español",
  previousQuestions: string[] = [],
  escenarioFijo?: string
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno del servidor');
  }

  const openai = new OpenAI({ apiKey, timeout: 120_000 });

  if (numPreguntas <= BATCH_SIZE) {
    return generateUniqueBatch(openai, extractedText, numPreguntas, dificultad, categoria, area, distribucion, customSystemPrompt, model, temperature, maxTokens, retries, idioma, previousQuestions, escenarioFijo);
  }

  // Divide en lotes de BATCH_SIZE para evitar timeouts en generaciones grandes
  const batches: number[] = [];
  let remaining = numPreguntas;
  while (remaining > 0) {
    batches.push(Math.min(remaining, BATCH_SIZE));
    remaining -= BATCH_SIZE;
  }

  const allQuestions: GeneratedQuestion[] = [];
  let knownQuestions = [...previousQuestions];
  for (const batchCount of batches) {
    const batchQuestions = await generateUniqueBatch(
      openai, extractedText, batchCount, dificultad, categoria, area, distribucion,
      customSystemPrompt, model, temperature, maxTokens, retries, idioma, knownQuestions
    );
    allQuestions.push(...batchQuestions);
    knownQuestions = knownQuestions.concat(batchQuestions.map((q) => q.pregunta));
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
    area: typeof obj.area === 'string' ? obj.area : 'General',
  };
}

// ── Casos prácticos: modo adicional de generación (escenario + N preguntas asociadas) ──

const CASE_LENGTH_INSTRUCTIONS: Record<CaseLength, string> = {
  Corta: 'Escribe un escenario muy breve: 2 a 3 frases, lo mínimo para establecer quién, qué situación y qué debe resolver.',
  Media: 'Escribe un escenario de longitud media: un párrafo de 4 a 6 frases, con el personaje, su rol y la situación concreta que enfrenta.',
  Detallada: 'Escribe un escenario detallado: 2 a 3 párrafos, incluyendo el personaje, su rol, el contexto organizacional, y los detalles del procedimiento o situación relevantes para responder las preguntas.',
};

function caseTypeInstruction(tipo: CaseType): string {
  if (tipo === 'Automático') {
    return 'Elige libremente el tipo de caso (operativo, atención al cliente, seguridad de la información, administrativo, legal, financiero, comercial, tecnológico, etc.) según lo que mejor se ajuste al contenido del documento, e indícalo en "tipo_caso".';
  }
  return `Enmarca cada escenario dentro del ámbito "${tipo}" e indícalo tal cual en "tipo_caso".`;
}

function buildCasePrompt(
  caseSizes: number[],
  dificultad: string,
  categoria: string,
  area: string,
  distribucion: Record<QuestionType, number>,
  extractedText: string,
  idioma: string,
  tipo: CaseType,
  longitud: CaseLength,
  previousQuestions: string[] = []
): string {
  const previousQuestionsBlock = previousQuestions.length > 0
    ? `\nPREGUNTAS YA GENERADAS EN LOTES ANTERIORES (NO REPETIR)\nEstas preguntas ya fueron generadas para esta misma evaluación. NO generes preguntas iguales, ni reformulaciones del mismo enunciado, ni preguntas que evalúen exactamente el mismo punto específico del documento:\n${previousQuestions.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nGenera contenido NUEVO: explora otras secciones, detalles, procesos o matices del documento que aún no hayan sido evaluados por las preguntas anteriores.\n`
    : '';

  const casosDescripcion = caseSizes
    .map((size, i) => `  * Caso ${i + 1}: exactamente ${size} pregunta(s) asociada(s).`)
    .join('\n');

  return `Eres un experto diseñador de evaluaciones basadas en casos prácticos. Genera ${caseSizes.length} caso(s) práctico(s) a partir del siguiente texto, cada uno con su escenario y sus preguntas de aplicación asociadas.

Parámetros:
- Idioma de salida: ${idioma} (TODO el contenido debe estar en ${idioma})
- Dificultad: ${dificultad}
- Categoría: ${categoria || 'General'}
- Área: ${area || 'General'}
- Distribución por tipo de pregunta (aplica al conjunto de todas las preguntas de todos los casos):
  * Selección única: ${distribucion.seleccion_unica}%
  * Selección múltiple: ${distribucion.seleccion_multiple}%
  * Verdadero/Falso: ${distribucion.verdadero_falso}%
- Cantidad de casos y preguntas por caso:
${casosDescripcion}
- Longitud del escenario: ${longitud}. ${CASE_LENGTH_INSTRUCTIONS[longitud]}
- Tipo de caso: ${caseTypeInstruction(tipo)}
${previousQuestionsBlock}
Texto del documento:
${extractedText}

INSTRUCCIONES PARA CADA CASO PRÁCTICO:
1. Identifica un proceso, situación o procedimiento relevante del documento.
2. Construye un escenario realista y coherente: crea un personaje con un rol creíble dentro de la organización y una situación concreta relacionada con ese proceso.
3. El campo "escenario" debe contener la narrativa completa (personaje, rol, contexto, situación) — a diferencia del campo "contexto" de cada pregunta, el "escenario" SÍ puede y debe incluir el detalle necesario para que las preguntas tengan sentido.
4. A partir de ese escenario, formula las preguntas indicadas, evaluando análisis, interpretación o toma de decisiones sobre la situación planteada — no preguntas memorísticas sueltas.
5. Todas las preguntas de un mismo caso deben ser consistentes entre sí y con el escenario; no deben contradecirse.

Genera un JSON válido con el siguiente formato exacto:
{
  "casos": [
    {
      "id": 1,
      "tipo_caso": "tipo del caso según las instrucciones",
      "escenario": "narrativa completa del caso práctico",
      "preguntas": [
        {
          "tipo": "seleccion_unica|seleccion_multiple|verdadero_falso",
          "pregunta": "enunciado completo de la pregunta, referido al escenario",
          "contexto": "introducción breve al tema general, máximo 2 frases, SIN repetir el escenario ni revelar la respuesta",
          "opciones": ["opción A", "opción B", "opción C", "opción D"],
          "respuesta_correcta": [0],
          "justificacion": "explicación de por qué esa opción es correcta en el contexto del caso",
          "dificultad": "${dificultad}",
          "categoria": "${categoria || 'General'}",
          "area": "${area || 'General'}"
        }
      ]
    }
  ]
}

REGLAS OBLIGATORIAS — incumplirlas invalida el caso:
- Devuelve exactamente ${caseSizes.length} caso(s), con la cantidad exacta de preguntas indicada arriba para cada uno.
- Todos los campos son requeridos; nunca los omitas ni los dejes vacíos.
- "escenario" debe tener al menos 20 caracteres y no puede estar vacío.
- "pregunta" y "justificacion" deben tener al menos 10 caracteres cada uno.
- "opciones" debe tener exactamente 4 elementos para seleccion_unica y seleccion_multiple, y exactamente 2 para verdadero_falso.
- "respuesta_correcta" contiene los índices base-0 de las opciones correctas dentro del array "opciones"; debe tener al menos un elemento válido.
- El JSON no debe contener comentarios ni texto fuera del objeto raíz.
Mantén precisión pedagógica y calibra la dificultad al nivel solicitado.`;
}

type CaseGroup = {
  tipo_caso: string;
  escenario: string;
  questions: GeneratedQuestion[];
};

function normalizeCase(raw: unknown): CaseGroup | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const escenario = typeof obj.escenario === 'string' ? obj.escenario.trim() : '';
  if (!escenario) return null;

  const tipo_caso = typeof obj.tipo_caso === 'string' && obj.tipo_caso.trim() ? obj.tipo_caso.trim() : 'General';

  const preguntasRaw: unknown[] = Array.isArray(obj.preguntas) ? obj.preguntas : [];
  const questions = preguntasRaw
    .map((q, i) => normalizeQuestion(q, i))
    .filter((q): q is GeneratedQuestion => q !== null)
    .map((q) => ({ ...q, escenario, tipo_caso, es_caso_practico: true }));
  if (questions.length === 0) return null;

  return { tipo_caso, escenario, questions };
}

async function generateCaseBatch(
  openai: OpenAI,
  extractedText: string,
  caseSizes: number[],
  dificultad: string,
  categoria: string,
  area: string,
  distribucion: Record<QuestionType, number>,
  customSystemPrompt: string | undefined,
  model: string,
  temperature: number,
  maxTokens: number,
  retries: number,
  idioma: string,
  tipo: CaseType,
  longitud: CaseLength,
  previousQuestions: string[] = []
): Promise<CaseGroup[]> {
  const prompt = buildCasePrompt(caseSizes, dificultad, categoria, area, distribucion, extractedText, idioma, tipo, longitud, previousQuestions);
  let lastError: Error = new Error('Error desconocido al generar casos prácticos');

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10_000));
    }
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT },
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
      const raw: unknown[] = Array.isArray(parsed.casos) ? parsed.casos : [];
      return raw
        .map((c) => normalizeCase(c))
        .filter((c): c is CaseGroup => c !== null);
    } catch (err) {
      lastError = err as Error;
      if (!isRetryableError(err)) break;
    }
  }
  throw lastError;
}

const MAX_DEDUPE_ATTEMPTS_CASOS = 3;

// Genera los casos indicados por `caseSizes`, evitando duplicar preguntas de `previousQuestions`.
// Si un caso completo contiene alguna pregunta duplicada, se descarta el caso entero (no la pregunta suelta)
// y se reintenta, igual que `generateUniqueBatch` pero a nivel de caso.
async function generateUniqueCaseBatch(
  openai: OpenAI,
  extractedText: string,
  caseSizes: number[],
  dificultad: string,
  categoria: string,
  area: string,
  distribucion: Record<QuestionType, number>,
  customSystemPrompt: string | undefined,
  model: string,
  temperature: number,
  maxTokens: number,
  retries: number,
  idioma: string,
  tipo: CaseType,
  longitud: CaseLength,
  previousQuestions: string[]
): Promise<CaseGroup[]> {
  const seen = new Set(previousQuestions.map(normalizeQuestionText));
  const knownQuestions = [...previousQuestions];
  const accepted: CaseGroup[] = [];
  let remainingSizes = [...caseSizes];

  for (let attempt = 0; attempt < MAX_DEDUPE_ATTEMPTS_CASOS && remainingSizes.length > 0; attempt++) {
    const attemptTemperature = attempt === 0 ? temperature : Math.min(1, temperature + attempt * 0.15);
    const groups = await generateCaseBatch(
      openai, extractedText, remainingSizes, dificultad, categoria, area, distribucion,
      customSystemPrompt, model, attemptTemperature, maxTokens, retries, idioma, tipo, longitud, knownQuestions
    );

    let acceptedCount = 0;
    for (const group of groups) {
      const hasDuplicate = group.questions.some((q) => seen.has(normalizeQuestionText(q.pregunta)));
      if (hasDuplicate) continue;
      group.questions.forEach((q) => {
        seen.add(normalizeQuestionText(q.pregunta));
        knownQuestions.push(q.pregunta);
      });
      accepted.push(group);
      acceptedCount++;
    }
    remainingSizes = remainingSizes.slice(acceptedCount);
  }

  return accepted;
}

const CASE_BATCH_SIZE = 12;

// Analogía de `generateQuestionsServer` para el modo de casos prácticos.
// Función completamente nueva y separada: no reemplaza ni altera el flujo plano existente.
export async function generateCaseQuestionsServer(
  extractedText: string,
  numPreguntas: number,
  dificultad: string,
  categoria: string,
  area: string,
  distribucion: Record<QuestionType, number>,
  casosPracticos: CasosPracticosConfig,
  customSystemPrompt?: string,
  model = "gpt-4o-mini",
  temperature = 0.3,
  maxTokens = 8192,
  retries = 3,
  idioma = "Español",
  previousQuestions: string[] = []
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno del servidor');
  }

  const openai = new OpenAI({ apiKey, timeout: 120_000 });

  const preguntasPorCaso = Math.max(1, casosPracticos.preguntasPorCaso);
  const totalCases = Math.ceil(numPreguntas / preguntasPorCaso);
  const allCaseSizes: number[] = Array.from({ length: totalCases }, (_, i) =>
    i < totalCases - 1 ? preguntasPorCaso : numPreguntas - preguntasPorCaso * (totalCases - 1)
  );

  // Trocea por caso (nunca por pregunta suelta) para no partir un caso entre dos llamadas.
  const chunks: number[][] = [];
  let current: number[] = [];
  let currentSum = 0;
  for (const size of allCaseSizes) {
    if (current.length > 0 && currentSum + size > CASE_BATCH_SIZE) {
      chunks.push(current);
      current = [];
      currentSum = 0;
    }
    current.push(size);
    currentSum += size;
  }
  if (current.length > 0) chunks.push(current);

  const allQuestions: GeneratedQuestion[] = [];
  let knownQuestions = [...previousQuestions];
  let caseCounter = 0;

  for (const chunkSizes of chunks) {
    const groups = await generateUniqueCaseBatch(
      openai, extractedText, chunkSizes, dificultad, categoria, area, distribucion,
      customSystemPrompt, model, temperature, maxTokens, retries, idioma,
      casosPracticos.tipo, casosPracticos.longitud, knownQuestions
    );
    for (const group of groups) {
      const caso_id = `caso-${caseCounter++}`;
      const taggedQuestions = group.questions.map((q) => ({ ...q, caso_id }));
      allQuestions.push(...taggedQuestions);
      knownQuestions = knownQuestions.concat(taggedQuestions.map((q) => q.pregunta));
    }
  }

  return allQuestions.map((q, i) => ({ ...q, id: i + 1 }));
}

type GenerateQuestionsInput = {
  extractedText: string;
  numPreguntas: number;
  dificultad: string;
  categoria: string;
  area: string;
  distribucion: Record<string, number>;
  customSystemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
  idioma?: string;
  previousQuestions?: string[];
  casosPracticos?: {
    habilitado: boolean;
    tipo: string;
    longitud: string;
    preguntasPorCaso: number;
  };
  escenarioFijo?: string;
};

export const generateQuestionsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateQuestionsInput) => data)
  .handler(async ({ data }) => {
    if (data.casosPracticos?.habilitado) {
      return generateCaseQuestionsServer(
        data.extractedText,
        data.numPreguntas,
        data.dificultad,
        data.categoria,
        data.area,
        data.distribucion as Record<QuestionType, number>,
        data.casosPracticos as CasosPracticosConfig,
        data.customSystemPrompt,
        data.model,
        data.temperature,
        data.maxTokens,
        data.retries,
        data.idioma,
        data.previousQuestions
      );
    }
    return generateQuestionsServer(
      data.extractedText,
      data.numPreguntas,
      data.dificultad,
      data.categoria,
      data.area,
      data.distribucion as Record<QuestionType, number>,
      data.customSystemPrompt,
      data.model,
      data.temperature,
      data.maxTokens,
      data.retries,
      data.idioma,
      data.previousQuestions,
      data.escenarioFijo
    );
  });

// ── Foro: generación de artículos con IA a partir de documentos ──────────────

const FORO_SYSTEM_PROMPT = `ROL DEL MODELO
Actúas como un editor experto en documentación técnica y gestión del conocimiento corporativo. Tu tarea es transformar un documento (manual, guía, política o material de capacitación) en un artículo de conocimiento bien estructurado para un foro interno, PRESERVANDO POR COMPLETO su contenido original.

REGLA CRÍTICA — PRESERVACIÓN DEL CONTENIDO
- Debes conservar el 100% de la información, datos, cifras, procedimientos y pasos del documento original.
- NO resumas, no omitas, no acortes ni elimines ningún procedimiento, regla o dato técnico.
- NO modifiques el significado ni el orden de los pasos de un procedimiento.
- NO agregues información externa que no esté en el documento.

LO ÚNICO QUE PUEDES MEJORAR
- Organización general del contenido (secciones lógicas).
- Títulos y subtítulos (usa <h2> para secciones principales y <h3> para subsecciones).
- Formato: listas (<ul>/<ol>/<li>) para enumeraciones o pasos, tablas (<table>/<thead>/<tbody>/<tr>/<th>/<td>) para datos tabulares.
- Legibilidad: párrafos cortos y claros (<p>), <strong> para términos clave, <blockquote> para notas o advertencias importantes.
- Resaltado de información crítica con <mark> (usar con moderación, solo en advertencias, requisitos obligatorios o datos que no se deben pasar por alto).

CONTENIDO ADICIONAL OPCIONAL
Si el documento se presta para ello, agrega AL FINAL del artículo (dentro del mismo HTML de "contenido"):
- Una sección "<h2>Preguntas frecuentes</h2>" con 3 a 6 preguntas y respuestas relevantes, basadas únicamente en el documento.
- Una sección "<h2>Glosario</h2>" con los términos técnicos o siglas del documento y su definición.
Si el documento es muy corto o no tiene términos técnicos relevantes, omite estas secciones (no las inventes).

FORMATO DE SALIDA
Responde únicamente con un JSON válido, sin texto adicional fuera del objeto, con esta forma exacta:
{
  "titulo": "título claro y descriptivo del artículo",
  "contenido": "HTML completo del artículo (incluyendo FAQ y Glosario si aplica), usando solo las etiquetas indicadas arriba",
  "resumen": "resumen ejecutivo de 2 a 4 frases",
  "palabras_clave": ["palabra clave 1", "palabra clave 2"],
  "etiquetas_sugeridas": ["etiqueta 1", "etiqueta 2"],
  "categoria_sugerida": "una categoría breve (2-4 palabras)"
}`;

export type GeneratedForoArticulo = {
  titulo: string;
  contenido: string;
  resumen: string;
  palabras_clave: string[];
  etiquetas_sugeridas: string[];
  categoria_sugerida: string;
};

function normalizeForoArticulo(parsed: unknown): GeneratedForoArticulo {
  const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;

  const titulo = typeof obj.titulo === 'string' ? obj.titulo.trim() : '';
  const contenido = typeof obj.contenido === 'string' ? obj.contenido.trim() : '';
  if (!titulo || !contenido) {
    throw new Error('La IA no devolvió un artículo válido (falta título o contenido)');
  }

  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];

  return {
    titulo,
    contenido,
    resumen: typeof obj.resumen === 'string' ? obj.resumen.trim() : '',
    palabras_clave: asStringArray(obj.palabras_clave),
    etiquetas_sugeridas: asStringArray(obj.etiquetas_sugeridas),
    categoria_sugerida: typeof obj.categoria_sugerida === 'string' ? obj.categoria_sugerida.trim() : '',
  };
}

export async function generateForoArticuloServer(
  extractedText: string,
  idioma = 'Español',
  model = 'gpt-4o',
  temperature = 0.2,
  maxTokens = 16_384,
  retries = 3,
): Promise<GeneratedForoArticulo> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno del servidor');
  }
  if (!extractedText.trim()) {
    throw new Error('El documento no contiene texto extraíble');
  }

  const openai = new OpenAI({ apiKey, timeout: 180_000 });
  const userPrompt = `Transforma el siguiente documento en un artículo de conocimiento, siguiendo estrictamente las reglas del sistema (preservar el 100% del contenido, solo mejorar formato/organización).

Idioma de salida: ${idioma} — el título, el contenido (incluyendo FAQ y Glosario si aplica), el resumen, las palabras clave, las etiquetas sugeridas y la categoría sugerida deben estar TODOS en ${idioma}, sin importar el idioma original del documento.

Documento:
${extractedText}`;

  let lastError: Error = new Error('Error desconocido al generar el artículo');

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10_000));
    }
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: FORO_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });

      if (response.choices[0].finish_reason === 'length') {
        throw new Error('truncated: la respuesta se cortó por límite de tokens; el documento es muy extenso, intenta dividirlo en partes más pequeñas');
      }

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No se recibió respuesta de OpenAI');

      return normalizeForoArticulo(JSON.parse(content));
    } catch (err) {
      lastError = err as Error;
      if (!isRetryableError(err)) break;
    }
  }
  throw lastError;
}

type GenerateForoArticuloInput = {
  extractedText: string;
  idioma?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
};

export const generateForoArticuloFn = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateForoArticuloInput) => data)
  .handler(async ({ data }) => {
    return generateForoArticuloServer(data.extractedText, data.idioma, data.model, data.temperature, data.maxTokens, data.retries);
  });

type ExtractImageTextInput = {
  base64: string;
};

export const extractImageTextFn = createServerFn({ method: 'POST' })
  .inputValidator((data: ExtractImageTextInput) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
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

// ── Feedback personalizado de resultados de evaluación ───────────────────────

const RESULT_FEEDBACK_SYSTEM_PROMPT = `ROL DEL MODELO
Actúas como un mentor experto de una plataforma de aprendizaje corporativo moderna (en el mismo espíritu que Coursera, LinkedIn Learning o Duolingo), dando retroalimentación personalizada a un colaborador después de presentar una evaluación interna.

CONTEXTO DE ENTRADA
Recibirás un documento de referencia (material de estudio, manual o guía sobre el que se basó la evaluación) y el detalle completo de las respuestas del participante: para cada pregunta, su enunciado, contexto, tipo, categoría administrativa (pista, no definitiva), las opciones disponibles, cuáles seleccionó, si esa pregunta quedó correcta, parcial o incorrecta, y la justificación de la respuesta correcta. Algunas preguntas incluyen además un "escenario": la narrativa completa de un caso práctico (personaje, rol, situación) del que se derivó la pregunta — a diferencia del "contexto" (solo la etiqueta breve del tema), el "escenario" describe la situación completa que el participante debía analizar.

USO DEL ESCENARIO EN EL ANÁLISIS
Cuando una pregunta incluya "escenario", tenlo en cuenta al inferir la competencia evaluada: ese tipo de pregunta evalúa aplicación práctica, análisis o toma de decisiones sobre una situación realista, no memorización simple. Si el participante falló una pregunta con escenario, la "explicacion" de esa mejora puede referirse brevemente a qué tipo de decisión o análisis se esperaba en esa situación — sin citar el escenario textualmente ni repetirlo.

REGLA CENTRAL — ANÁLISIS GLOBAL, NO POR PREGUNTA
Tienes PROHIBIDO producir un resumen pregunta por pregunta ("acertaste la pregunta 3", "fallaste la pregunta 5"). Debes analizar el conjunto de respuestas para inferir **competencias** (habilidades o temas de fondo, ej. "Empatía con el cliente", "Control emocional", "Resolución de conflictos", "Escucha activa") a partir del contenido semántico de las preguntas — la categoría administrativa que recibes es solo una pista adicional, no la unidad de análisis. Agrupa siempre por competencia, nunca por pregunta individual.

QUÉ DEBES GENERAR

1. "resumen": un párrafo de 3 a 5 líneas que describa el desempeño general — debe mencionar el nivel general alcanzado, la o las principales fortalezas, y la principal oportunidad de mejora. Tono narrativo, no una lista.

2. "fortalezas": agrupa los aciertos por competencia (nunca por pregunta). Para cada competencia detectada como fuerte, da 1 a 3 "detalles" concretos de qué demostró dominar el participante (no "acertaste la pregunta X").

3. "mejoras": detecta PATRONES entre las respuestas incorrectas o parciales y agrúpalos por competencia (no listes cada respuesta incorrecta suelta). Para cada mejora, entrega:
   - "explicacion": qué concepto o procedimiento se confundió y por qué la respuesta correcta importa en la práctica.
   - "practica": la práctica recomendada y accionable para ese punto específico.

4. "dominio": clasifica CADA competencia evaluada (las mismas que aparecen en fortalezas/mejoras, más cualquier otra competencia cubierta por la evaluación) con un nivel "alto", "medio" o "bajo", inferido de la proporción de aciertos de esa competencia.

5. "recomendaciones": 3 a 5 acciones concretas y accionables (nunca genéricas tipo "estudia más"), derivadas directamente de las mejoras detectadas.

6. "cierre": un mensaje de cierre motivador y personalizado, mencionando el efecto esperado de fortalecer el punto más débil detectado.

USO DEL DOCUMENTO DE REFERENCIA
Cuando el concepto que el participante confundió aparezca explícitamente en el documento de referencia, usa esa idea para fundamentar el "porqué" en "mejoras.explicacion" — parafraseando la idea principal en una frase corta. Nunca copies fragmentos largos del documento ni cites literalmente. Si el documento no cubre el concepto, explica el porqué con criterio profesional propio, sin inventar que proviene del documento.

REGLAS OBLIGATORIAS
- No repitas el enunciado literal de ninguna pregunta ni la justificación tal cual fue entregada.
- Usa EXACTAMENTE el mismo nombre de competencia en "fortalezas", "mejoras" y "dominio" cuando te refieras al mismo concepto — nunca uses sinónimos distintos para la misma competencia.
- Tono: profesional, positivo, cercano, en segunda persona ("tú"), orientado al aprendizaje — nunca condescendiente ni punitivo.
- Si no hay aciertos, "fortalezas" puede ser un arreglo vacío; si no hay errores, "mejoras" puede ser un arreglo vacío. No inventes contenido para rellenar.

FORMATO DE SALIDA
Responde únicamente con un JSON válido, sin texto adicional fuera del objeto, con esta forma exacta:
{
  "resumen": "párrafo de 3 a 5 líneas",
  "fortalezas": [{ "competencia": "...", "detalles": ["...", "..."] }],
  "mejoras": [{ "competencia": "...", "explicacion": "...", "practica": "..." }],
  "dominio": [{ "competencia": "...", "nivel": "alto|medio|bajo" }],
  "recomendaciones": ["...", "...", "..."],
  "cierre": "..."
}`;

export type FeedbackBreakdownItem = {
  enunciado: string;
  contexto?: string;
  /** Narrativa completa del caso práctico del que se derivó la pregunta, si aplica. */
  escenario?: string;
  tipo: string;
  categoria?: string;
  opciones: string[];
  seleccionadas: string[];
  estado: 'correcta' | 'parcial' | 'incorrecta';
  justificacion?: string;
};

export type MasteryLevel = 'alto' | 'medio' | 'bajo';

export type GeneratedResultFeedback = {
  resumen: string;
  fortalezas: { competencia: string; detalles: string[] }[];
  mejoras: { competencia: string; explicacion: string; practica: string }[];
  dominio: { competencia: string; nivel: MasteryLevel }[];
  recomendaciones: string[];
  cierre: string;
};

export function normalizeResultFeedback(parsed: unknown): GeneratedResultFeedback {
  const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
  const asString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

  const fortalezas = Array.isArray(obj.fortalezas)
    ? (obj.fortalezas as unknown[])
        .map((f) => {
          const item = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
          const competencia = asString(item.competencia);
          if (!competencia) return null;
          return { competencia, detalles: asStringArray(item.detalles) };
        })
        .filter((f): f is { competencia: string; detalles: string[] } => f !== null)
    : [];

  const mejoras = Array.isArray(obj.mejoras)
    ? (obj.mejoras as unknown[])
        .map((m) => {
          const item = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
          const competencia = asString(item.competencia);
          if (!competencia) return null;
          return { competencia, explicacion: asString(item.explicacion), practica: asString(item.practica) };
        })
        .filter((m): m is { competencia: string; explicacion: string; practica: string } => m !== null)
    : [];

  const dominio = Array.isArray(obj.dominio)
    ? (obj.dominio as unknown[])
        .map((d) => {
          const item = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
          const competencia = asString(item.competencia);
          if (!competencia) return null;
          const nivelRaw = asString(item.nivel);
          const nivel: MasteryLevel = nivelRaw === 'alto' || nivelRaw === 'bajo' ? nivelRaw : 'medio';
          return { competencia, nivel };
        })
        .filter((d): d is { competencia: string; nivel: MasteryLevel } => d !== null)
    : [];

  return {
    resumen: asString(obj.resumen),
    fortalezas,
    mejoras,
    dominio,
    recomendaciones: asStringArray(obj.recomendaciones),
    cierre: asString(obj.cierre),
  };
}

export async function generateResultFeedbackServer(
  documentoTexto: string,
  breakdown: FeedbackBreakdownItem[],
  model = 'gpt-4o',
  temperature = 0.5,
  maxTokens = 4096,
  retries = 3,
): Promise<GeneratedResultFeedback> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno del servidor');
  }
  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    throw new Error('No hay respuestas para generar el feedback');
  }

  const openai = new OpenAI({ apiKey, timeout: 120_000 });
  const userPrompt = `Documento de referencia:
${documentoTexto || '(sin documento de referencia disponible)'}

Detalle de las respuestas del participante (JSON):
${JSON.stringify(breakdown, null, 2)}

Genera el feedback siguiendo estrictamente el formato indicado en las instrucciones del sistema.`;

  let lastError: Error = new Error('Error desconocido al generar el feedback');

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10_000));
    }
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: RESULT_FEEDBACK_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });

      if (response.choices[0].finish_reason === 'length') {
        throw new Error('truncated: la respuesta se cortó por límite de tokens');
      }

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No se recibió respuesta de OpenAI');

      return normalizeResultFeedback(JSON.parse(content));
    } catch (err) {
      lastError = err as Error;
      if (!isRetryableError(err)) break;
    }
  }
  throw lastError;
}

type GenerateResultFeedbackInput = {
  documentoTexto: string;
  breakdown: FeedbackBreakdownItem[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
};

export const generateResultFeedbackFn = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateResultFeedbackInput) => data)
  .handler(async ({ data }) => {
    return generateResultFeedbackServer(
      data.documentoTexto,
      data.breakdown,
      data.model,
      data.temperature,
      data.maxTokens,
      data.retries,
    );
  });
