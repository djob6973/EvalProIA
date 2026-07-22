import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";

const MAX_IMAGE_BYTES = 3_000_000;
const IMAGE_MIME_RE = /^image\/(png|jpeg|webp|gif|svg\+xml)/;

// Nodo TipTap propio para video embebido. Nunca acepta un <iframe src> arbitrario —
// solo se inserta a través de toSafeVideoEmbedSrc(), que reconstruye una URL de embed
// segura de YouTube/Vimeo a partir del link que pega el usuario.
const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: "iframe" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["iframe", { ...HTMLAttributes, width: 560, height: 315, frameborder: 0, allowfullscreen: "" }];
  },
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toSafeVideoEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      const id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
      if (id && /^[\w-]{6,}$/.test(id)) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id && /^[\w-]{6,}$/.test(id)) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "vimeo.com" || u.hostname === "www.vimeo.com" || u.hostname === "player.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

function Toolbar({
  editor,
  t,
  onInsertImage,
  onInsertVideo,
}: {
  editor: Editor | null;
  t: (key: string) => string;
  onInsertImage: () => void;
  onInsertVideo: () => void;
}) {
  if (!editor) return null;
  const btn = (active: boolean) =>
    `grid h-8 w-8 place-items-center rounded-[8px] transition-colors ${
      active ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-2)]"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
      <button type="button" className={btn(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title={t("richText.toolbarHeading")}>
        <Heading2 className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()} title={t("richText.toolbarBold")}>
        <Bold className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("underline"))}
        onClick={() => editor.chain().focus().toggleUnderline().run()} title={t("richText.toolbarUnderline")}>
        <UnderlineIcon className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()} title={t("richText.toolbarBulletList")}>
        <List className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()} title={t("richText.toolbarOrderedList")}>
        <ListOrdered className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("blockquote"))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()} title={t("richText.toolbarQuote")}>
        <Quote className="size-4" />
      </button>
      <button type="button" className={btn(false)} onClick={onInsertImage} title={t("richText.toolbarImage")}>
        <ImageIcon className="size-4" />
      </button>
      <button type="button" className={btn(false)} onClick={onInsertVideo} title={t("richText.toolbarVideo")}>
        <VideoIcon className="size-4" />
      </button>
    </div>
  );
}

interface RichTextFieldProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * Campo de texto enriquecido controlado (HTML), reutilizado para el escenario de un
 * caso práctico. Núcleo extraído de src/components/foro/ArticleEditor.tsx pero
 * desacoplado de los tipos/estado propios del Foro (título, resumen, adjuntos, etc.).
 */
export function RichTextField({ value, onChange, placeholder }: RichTextFieldProps) {
  const { t } = useTranslation();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const insertImageFile = async (file: File, editorInstance: Editor | null, pos?: number) => {
    if (!editorInstance) return;
    setImageError(null);
    if (!IMAGE_MIME_RE.test(file.type)) {
      setImageError(t("richText.imageTypeNotAllowed", { name: file.name }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(t("richText.imageTooLarge", { name: file.name }));
      return;
    }
    const src = await fileToDataUrl(file);
    if (pos !== undefined) {
      editorInstance.chain().focus().insertContentAt(pos, { type: "image", attrs: { src } }).run();
    } else {
      editorInstance.chain().focus().setImage({ src }).run();
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      VideoEmbed,
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none dark:prose-invert min-h-[160px] focus:outline-none [&_img]:block [&_img]:mx-auto [&_img]:max-w-full [&_img]:rounded-lg [&_iframe]:mx-auto [&_iframe]:block [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full [&_iframe]:max-w-full [&_iframe]:rounded-lg",
      },
      handleDrop: (view, event) => {
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith("image/")) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        insertImageFile(file, editor, coords?.pos);
        return true;
      },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        insertImageFile(file, editor);
        return true;
      },
    },
  });

  // Mantiene el editor sincronizado si `value` cambia desde afuera (ej. se abre el
  // formulario para editar otra pregunta y el modal/editor no se desmonta). Compara
  // contra el HTML actual del editor para no pisar el cursor mientras el usuario escribe.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  const handleInsertVideo = () => {
    if (!editor) return;
    const url = window.prompt(t("richText.videoPrompt"));
    if (!url) return;
    const embedSrc = toSafeVideoEmbedSrc(url);
    if (!embedSrc) {
      window.alert(t("richText.videoInvalid"));
      return;
    }
    editor.chain().focus().insertContent({ type: "videoEmbed", attrs: { src: embedSrc } }).run();
  };

  return (
    <div className="rounded-[12px] border" style={{ borderColor: "var(--border)" }}>
      <Toolbar
        editor={editor}
        t={t}
        onInsertImage={() => imageInputRef.current?.click()}
        onInsertVideo={handleInsertVideo}
      />
      <div className="max-h-[320px] overflow-y-auto px-3 py-2">
        <EditorContent editor={editor} />
      </div>
      {imageError && <p className="px-3 pb-2 text-[12px] text-destructive">{imageError}</p>}
      <input
        ref={imageInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertImageFile(file, editor);
          e.target.value = "";
        }}
      />
    </div>
  );
}
