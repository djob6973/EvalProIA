import DOMPurify from 'isomorphic-dompurify';

// Solo se permite un <iframe> si su src es exactamente una URL de embed de YouTube o
// Vimeo reconstruida por nosotros (ver RichTextField) — nunca un iframe pegado a mano.
const SAFE_VIDEO_SRC_RE =
  /^https:\/\/(www\.)?youtube\.com\/embed\/[\w-]+(\?[\w=&-]*)?$|^https:\/\/player\.vimeo\.com\/video\/\d+(\?[\w=&-]*)?$/;

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  const el = node as Element;
  if (el.tagName === 'IFRAME') {
    const src = el.getAttribute('src') || '';
    if (!SAFE_VIDEO_SRC_RE.test(src)) {
      el.remove();
      return;
    }
    el.setAttribute('allowfullscreen', '');
    el.setAttribute('frameborder', '0');
    el.setAttribute('loading', 'lazy');
    el.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  } else if (el.tagName === 'A') {
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer nofollow');
  }
});

// Cubre tanto el editor de "Caso Práctico" (RichTextField) como el del Foro
// (ArticleEditor: encabezados, resaltado, tablas) — es un allow-list de formato,
// no de features; lo que se bloquea es script/estilos/eventos/iframes arbitrarios.
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'mark',
    'ul', 'ol', 'li', 'blockquote', 'img', 'iframe', 'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: [
    'src', 'alt', 'href', 'target', 'rel', 'allow', 'allowfullscreen', 'frameborder',
    'loading', 'referrerpolicy', 'width', 'height', 'colspan', 'rowspan',
  ],
  ALLOWED_URI_REGEXP: /^(?:https?:|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,|mailto:)/i,
};

/** Sanitiza HTML confiando solo en el allow-list de tags/atributos de este módulo. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Renderiza el campo "escenario" de forma segura, sea HTML (generado con el editor
 * enriquecido) o texto plano (casos guardados antes de este cambio — se envuelve en
 * párrafos antes de sanitizar para que los saltos de línea se sigan viendo).
 */
export function renderEscenarioHtml(raw: string | null | undefined): string {
  if (!raw) return '';
  const looksLikeHtml = raw.includes('<');
  const html = looksLikeHtml
    ? raw
    : raw
        .split(/\n{2,}/)
        .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
        .join('');
  return sanitizeHtml(html);
}

/** Extrae solo el texto (sin markup) — usado para pasarle el escenario al prompt de feedback IA. */
export function stripHtmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}
