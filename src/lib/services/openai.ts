import { extractImageTextFn } from '@/lib/services/openai-server';

export type DocumentSection = {
  type: 'title' | 'subtitle' | 'content';
  text: string;
  level?: number; // For hierarchical structure (1 for main title, 2 for subtitle, etc.)
};

export type StructuredDocument = {
  title: string;
  sections: DocumentSection[];
};

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

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    console.log('Iniciando extracción de PDF:', file.name, file.size, file.type);
    const arrayBuffer = await file.arrayBuffer();
    console.log('ArrayBuffer creado, tamaño:', arrayBuffer.byteLength);

    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log('PDF cargado exitosamente, número de páginas:', pdf.numPages);
    
    // Limit to first 50 pages to avoid excessive processing
    const maxPages = Math.min(pdf.numPages, 50);
    console.log(`Procesando ${maxPages} de ${pdf.numPages} páginas del PDF`);
    
    // Process pages in parallel for better performance
    const pagePromises = [];
    for (let i = 1; i <= maxPages; i++) {
      pagePromises.push(
        pdf.getPage(i).then(async (page) => {
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          return pageText;
        }).catch((error) => {
          console.error(`Error procesando página ${i}:`, error);
          return '';
        })
      );
    }
    
    const pageTexts = await Promise.all(pagePromises);
    const fullText = pageTexts.filter(text => text).join('\n');
    
    console.log('Texto extraído exitosamente, longitud:', fullText.length);
    
    if (pdf.numPages > 50) {
      console.log(`Nota: Solo se procesaron las primeras 50 páginas de ${pdf.numPages} páginas totales`);
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw new Error(`No se pudo extraer el texto del PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

async function extractStructuredTextFromPDF(file: File): Promise<StructuredDocument> {
  try {
    console.log('Iniciando extracción estructurada de PDF:', file.name);
    const arrayBuffer = await file.arrayBuffer();

    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Limit to first 50 pages to avoid excessive processing
    const maxPages = Math.min(pdf.numPages, 50);
    
    // Process pages in parallel for better performance
    const pagePromises = [];
    for (let i = 1; i <= maxPages; i++) {
      pagePromises.push(
        pdf.getPage(i).then(async (page) => {
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          return pageText;
        }).catch((error) => {
          console.error(`Error procesando página ${i}:`, error);
          return '';
        })
      );
    }
    
    const pageTexts = await Promise.all(pagePromises);
    const fullText = pageTexts.filter(text => text).join('\n');
    
    // Infer structure from text
    const sections: DocumentSection[] = [];
    const titleMatch = fullText.match(/^([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : file.name.replace(/\.[^/.]+$/, '');
    
    const lines = fullText.split('\n').filter((line: string) => line.trim());
    lines.forEach((line: string) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      // Detect titles (all caps, short lines, or numbered)
      const isAllCaps = trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 && /[a-zA-Z]/.test(trimmedLine);
      const isShort = trimmedLine.length < 100;
      const isNumbered = /^\d+\.\s/.test(trimmedLine);
      
      if ((isAllCaps && isShort) || isNumbered) {
        sections.push({
          type: 'title',
          text: trimmedLine,
          level: isNumbered ? parseInt(trimmedLine.match(/\d+/)?.[0] || '1') : 1
        });
      } else {
        sections.push({
          type: 'content',
          text: trimmedLine
        });
      }
    });
    
    return {
      title,
      sections
    };
  } catch (error) {
    console.error('Error extracting structured text from PDF:', error);
    // Fallback to plain text extraction
    try {
      const plainText = await extractTextFromPDF(file);
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        sections: [{
          type: 'content',
          text: plainText
        }]
      };
    } catch (fallbackError) {
      throw new Error('No se pudo extraer el texto del PDF. El archivo podría estar corrupto.');
    }
  }
}

async function extractTextFromDOCX(file: File): Promise<string> {
  try {
    const { default: mammoth } = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('No se pudo extraer el texto del DOCX. El archivo podría estar corrupto.');
  }
}

async function extractStructuredTextFromDOCX(file: File): Promise<StructuredDocument> {
  try {
    const { default: mammoth } = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();

    // Extract raw text first as fallback
    const rawResult = await mammoth.extractRawText({ arrayBuffer });
    const rawText = rawResult.value;
    
    // Parse HTML to extract structure
    const sections: DocumentSection[] = [];
    const titleMatch = rawText.match(/^([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : file.name.replace(/\.[^/.]+$/, '');
    
    // Simple structure inference from raw text
    const lines = rawText.split('\n').filter((line: string) => line.trim());
    lines.forEach((line: string) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      // Detect titles (all caps, short lines, or numbered)
      const isAllCaps = trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 && /[a-zA-Z]/.test(trimmedLine);
      const isShort = trimmedLine.length < 100;
      const isNumbered = /^\d+\.\s/.test(trimmedLine);
      
      if ((isAllCaps && isShort) || isNumbered) {
        sections.push({
          type: 'title',
          text: trimmedLine,
          level: isNumbered ? parseInt(trimmedLine.match(/\d+/)?.[0] || '1') : 1
        });
      } else {
        sections.push({
          type: 'content',
          text: trimmedLine
        });
      }
    });
    
    return {
      title,
      sections
    };
  } catch (error) {
    console.error('Error extracting structured text from DOCX:', error);
    // Fallback to plain text extraction
    try {
      const { default: mammoth } = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        sections: [{
          type: 'content',
          text: result.value
        }]
      };
    } catch (fallbackError) {
      throw new Error('No se pudo extraer el texto del DOCX. El archivo podría estar corrupto.');
    }
  }
}

export async function extractTextWithOCR(file: File): Promise<string> {
  try {
    // For text files, use direct extraction
    if (file.type === 'text/plain') {
      console.log('Extracción directa de archivo de texto');
      return await file.text();
    }

    // For PDF files, use pdf.js
    if (file.type === 'application/pdf') {
      console.log('Extracción de texto de PDF usando pdf.js');
      return await extractTextFromPDF(file);
    }

    // For DOCX files, use mammoth
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('Extracción de texto de DOCX usando mammoth');
      return await extractTextFromDOCX(file);
    }

    // For image files, delegate to server function (keeps API key off the client bundle)
    if (file.type.startsWith('image/')) {
      const base64 = await fileToBase64(file);
      console.log('Archivo convertido a base64, longitud:', base64.length);
      return await extractImageTextFn({ data: { base64 } });
    }

    throw new Error('Tipo de archivo no compatible. Por favor, usa archivos de texto (.txt), PDF (.pdf), DOCX (.docx) o imágenes (.jpg, .png).');
    
  } catch (error) {
    console.error('Error con OCR:', error);
    
    // Check if it's an API key error
    if (error instanceof Error && error.message.includes('API key')) {
      throw new Error('Error con la API key de OpenAI. Verifica que OPENAI_API_KEY esté configurada en las variables de entorno del servidor.');
    }
    
    // Check if it's a quota/limit error
    if (error instanceof Error && (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('429'))) {
      throw new Error('Has alcanzado el límite de tu API key de OpenAI. Verifica tu cuenta o usa una API key diferente.');
    }
    
    // Check if it's a model error
    if (error instanceof Error && error.message.includes('model')) {
      throw new Error('Error con el modelo de OpenAI. Verifica que tu API key tenga acceso a GPT-4o.');
    }
    
    // Check if it's a MIME type error
    if (error instanceof Error && error.message.includes('MIME type')) {
      throw new Error('Tipo de archivo no compatible con la API de visión de OpenAI. Por favor, usa archivos de texto (.txt), PDF (.pdf), DOCX (.docx) o imágenes (.jpg, .png).');
    }
    
    // Provide more detailed error information
    if (error instanceof Error) {
      throw new Error(`Error al extraer texto: ${error.message}`);
    }
    
    throw new Error('No se pudo extraer el texto del documento. Verifica tu API key de OpenAI.');
  }
}

export async function extractStructuredText(file: File): Promise<StructuredDocument> {
  try {
    // For text files, infer structure from plain text
    if (file.type === 'text/plain') {
      console.log('Extracción estructurada de archivo de texto');
      const text = await file.text();
      const lines = text.split('\n').filter((line: string) => line.trim());
      const titleMatch = text.match(/^([^\n]+)/);
      const title = titleMatch ? titleMatch[1].trim() : file.name.replace(/\.[^/.]+$/, '');
      
      const sections: DocumentSection[] = [];
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;
        
        const isAllCaps = trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 && /[a-zA-Z]/.test(trimmedLine);
        const isShort = trimmedLine.length < 100;
        const isNumbered = /^\d+\.\s/.test(trimmedLine);
        
        if ((isAllCaps && isShort) || isNumbered) {
          sections.push({
            type: 'title',
            text: trimmedLine,
            level: isNumbered ? parseInt(trimmedLine.match(/\d+/)?.[0] || '1') : 1
          });
        } else {
          sections.push({
            type: 'content',
            text: trimmedLine
          });
        }
      });
      
      return { title, sections };
    }

    // For PDF files, use structured extraction
    if (file.type === 'application/pdf') {
      console.log('Extracción estructurada de PDF usando pdf.js');
      return await extractStructuredTextFromPDF(file);
    }

    // For DOCX files, use structured extraction
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('Extracción estructurada de DOCX usando mammoth');
      return await extractStructuredTextFromDOCX(file);
    }

    // For image files, delegate to server function (keeps API key off the client bundle)
    if (file.type.startsWith('image/')) {
      const base64 = await fileToBase64(file);
      console.log('Archivo convertido a base64, longitud:', base64.length);
      const content = await extractImageTextFn({ data: { base64 } });

      // Infer structure from extracted text
      const lines = content.split('\n').filter((line: string) => line.trim());
      const titleMatch = content.match(/^([^\n]+)/);
      const title = titleMatch ? titleMatch[1].trim() : file.name.replace(/\.[^/.]+$/, '');

      const sections: DocumentSection[] = [];
      lines.forEach((line: string) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        const isAllCaps = trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 && /[a-zA-Z]/.test(trimmedLine);
        const isShort = trimmedLine.length < 100;
        const isNumbered = /^\d+\.\s/.test(trimmedLine);

        if ((isAllCaps && isShort) || isNumbered) {
          sections.push({
            type: 'title',
            text: trimmedLine,
            level: isNumbered ? parseInt(trimmedLine.match(/\d+/)?.[0] || '1') : 1
          });
        } else {
          sections.push({
            type: 'content',
            text: trimmedLine
          });
        }
      });
      
      return { title, sections };
    }

    throw new Error('Tipo de archivo no compatible. Por favor, usa archivos de texto (.txt), PDF (.pdf), DOCX (.docx) o imágenes (.jpg, .png).');
    
  } catch (error) {
    console.error('Error extracting structured text:', error);
    // Fallback to plain text extraction
    try {
      const plainText = await extractTextWithOCR(file);
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        sections: [{
          type: 'content',
          text: plainText
        }]
      };
    } catch (fallbackError) {
      throw new Error('No se pudo extraer el texto estructurado del documento.');
    }
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
