import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Highlighter,
  Table as TableIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  Paperclip,
  X,
  Loader2,
} from "lucide-react";
import { ForoAdjunto, ForoArticulo, ForoArticuloInput } from "@/lib/services/foro";

const MAX_ADJUNTO_BYTES = 5_000_000;
const ACCEPTED_MIME = /^image\/(png|jpeg|webp|gif|svg\+xml)|^application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|^text\/plain/;
const MAX_IMAGE_BYTES = 3_000_000;
const IMAGE_MIME_RE = /^image\/(png|jpeg|webp|gif|svg\+xml)/;

interface ArticleEditorProps {
  open: boolean;
  initial: ForoArticulo | ForoArticuloInput | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: ForoArticuloInput) => Promise<void>;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Toolbar({
  editor,
  t,
  onInsertImage,
}: {
  editor: Editor | null;
  t: (key: string) => string;
  onInsertImage: () => void;
}) {
  if (!editor) return null;
  const btn = (active: boolean) =>
    `grid h-8 w-8 place-items-center rounded-[8px] transition-colors ${
      active ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-2)]"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
      <button type="button" className={btn(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title={t("forum.toolbarHeading")}>
        <Heading2 className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()} title={t("forum.toolbarBold")}>
        <Bold className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("italic"))}
        onClick={() => editor.chain().focus().toggleItalic().run()} title={t("forum.toolbarItalic")}>
        <Italic className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("highlight"))}
        onClick={() => editor.chain().focus().toggleHighlight().run()} title={t("forum.toolbarHighlight")}>
        <Highlighter className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()} title={t("forum.toolbarBulletList")}>
        <List className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()} title={t("forum.toolbarOrderedList")}>
        <ListOrdered className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("blockquote"))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()} title={t("forum.toolbarQuote")}>
        <Quote className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("link"))}
        onClick={() => {
          const url = window.prompt(t("forum.linkPrompt"));
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }} title={t("forum.toolbarLink")}>
        <LinkIcon className="size-4" />
      </button>
      <button type="button" className={btn(false)} onClick={onInsertImage} title={t("forum.toolbarImage")}>
        <ImageIcon className="size-4" />
      </button>
      <button type="button" className={btn(false)}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title={t("forum.toolbarTable")}>
        <TableIcon className="size-4" />
      </button>
    </div>
  );
}

export function ArticleEditor({ open, initial, saving, onClose, onSave }: ArticleEditorProps) {
  const { t } = useTranslation();
  const [titulo, setTitulo] = useState("");
  const [resumen, setResumen] = useState("");
  const [categoria, setCategoria] = useState("");
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [adjuntos, setAdjuntos] = useState<ForoAdjunto[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const insertImageFile = async (file: File, editorInstance: Editor | null, pos?: number) => {
    if (!editorInstance) return;
    setImageError(null);
    if (!IMAGE_MIME_RE.test(file.type)) {
      setImageError(t("forum.imageTypeNotAllowed", { name: file.name }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(t("forum.imageTooLarge", { name: file.name }));
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
      StarterKit.configure({ link: { openOnClick: false } }),
      Highlight,
      Image.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder: t("forum.contentPlaceholder") }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none dark:prose-invert min-h-[260px] focus:outline-none [&_table]:w-full [&_td]:border [&_th]:border [&_td]:border-[var(--border)] [&_th]:border-[var(--border)] [&_td]:p-2 [&_th]:p-2 [&_img]:max-w-full [&_img]:rounded-lg",
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

  useEffect(() => {
    if (!open) return;
    setTitulo(initial?.titulo ?? "");
    setResumen(initial?.resumen ?? "");
    setCategoria(initial?.categoria ?? "");
    setEtiquetas(initial?.etiquetas ?? []);
    setTagInput("");
    setAdjuntos(initial?.adjuntos ?? []);
    setAttachError(null);
    setImageError(null);
    editor?.commands.setContent(initial?.contenido ?? "");
  }, [open, initial, editor]);

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !etiquetas.includes(tag) && etiquetas.length < 20) setEtiquetas((e) => [...e, tag]);
    setTagInput("");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setAttachError(null);
    for (const file of Array.from(files)) {
      if (adjuntos.length >= 10) { setAttachError(t("forum.maxAttachments")); break; }
      if (file.size > MAX_ADJUNTO_BYTES) { setAttachError(t("forum.attachmentTooLarge", { name: file.name })); continue; }
      if (!ACCEPTED_MIME.test(file.type)) { setAttachError(t("forum.attachmentTypeNotAllowed", { name: file.name })); continue; }
      const data_url = await fileToDataUrl(file);
      setAdjuntos((prev) => [...prev, { nombre: file.name, tipo: file.type, data_url, tamano: file.size }]);
    }
  };

  const submit = async (estado: "borrador" | "publicado") => {
    if (!titulo.trim() || !editor || editor.isEmpty) return;
    await onSave({
      titulo: titulo.trim(),
      contenido: editor.getHTML(),
      resumen: resumen.trim() || null,
      categoria: categoria.trim() || null,
      etiquetas,
      estado,
      adjuntos,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? t("forum.editorTitleEdit") : t("forum.editorTitleNew")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--muted-foreground)]">{t("forum.titleLabel")}</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={t("forum.titlePlaceholder")} />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--muted-foreground)]">{t("forum.summaryLabel")}</label>
            <Textarea
              value={resumen}
              onChange={(e) => setResumen(e.target.value)}
              placeholder={t("forum.summaryPlaceholder")}
              className="min-h-[60px] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[var(--muted-foreground)]">{t("forum.categoryLabel")}</label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder={t("forum.categoryPlaceholder")} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[var(--muted-foreground)]">{t("forum.tagsLabel")}</label>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                onBlur={addTag}
                placeholder={t("forum.tagsPlaceholder")}
              />
            </div>
          </div>

          {etiquetas.length > 0 && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {etiquetas.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12px] text-[var(--foreground)]">
                  {tag}
                  <button type="button" onClick={() => setEtiquetas((e) => e.filter((x) => x !== tag))} aria-label={t("forum.removeTag", { tag })}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--muted-foreground)]">{t("forum.contentLabel")}</label>
            <div className="rounded-[12px] border border-[var(--border)]">
              <Toolbar editor={editor} t={t} onInsertImage={() => imageInputRef.current?.click()} />
              <div className="max-h-[400px] overflow-y-auto px-3 py-2">
                <EditorContent editor={editor} />
              </div>
            </div>
            {imageError && <p className="mt-1 text-[12px] text-destructive">{imageError}</p>}
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

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[12px] font-medium text-[var(--muted-foreground)]">{t("forum.attachments")}</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:opacity-80"
              >
                <Paperclip className="size-3.5" /> {t("forum.addFile")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {attachError && <p className="mb-1 text-[12px] text-destructive">{attachError}</p>}
            {adjuntos.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {adjuntos.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-[10px] bg-[var(--surface-2)] px-3 py-1.5 text-[12px]">
                    <span className="truncate">{a.nombre}</span>
                    <button type="button" onClick={() => setAdjuntos((prev) => prev.filter((_, idx) => idx !== i))} aria-label={t("forum.removeAttachment", { name: a.nombre })}>
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("forum.cancel")}</Button>
          <Button variant="secondary" onClick={() => submit("borrador")} disabled={saving || !titulo.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />} {t("forum.saveDraft")}
          </Button>
          <Button onClick={() => submit("publicado")} disabled={saving || !titulo.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />} {t("forum.publish")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
