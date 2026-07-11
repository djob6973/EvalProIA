import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
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
  Paperclip,
  X,
  Loader2,
} from "lucide-react";
import { ForoAdjunto, ForoArticulo, ForoArticuloInput } from "@/lib/services/foro";

const MAX_ADJUNTO_BYTES = 5_000_000;
const ACCEPTED_MIME = /^image\/(png|jpeg|webp|gif|svg\+xml)|^application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|^text\/plain/;

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

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const btn = (active: boolean) =>
    `grid h-8 w-8 place-items-center rounded-[8px] transition-colors ${
      active ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-2)]"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
      <button type="button" className={btn(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título">
        <Heading2 className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita">
        <Bold className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("italic"))}
        onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva">
        <Italic className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("highlight"))}
        onClick={() => editor.chain().focus().toggleHighlight().run()} title="Resaltar">
        <Highlighter className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
        <List className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
        <ListOrdered className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("blockquote"))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Cita">
        <Quote className="size-4" />
      </button>
      <button type="button" className={btn(editor.isActive("link"))}
        onClick={() => {
          const url = window.prompt("URL del enlace");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }} title="Enlace">
        <LinkIcon className="size-4" />
      </button>
      <button type="button" className={btn(false)}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Insertar tabla">
        <TableIcon className="size-4" />
      </button>
    </div>
  );
}

export function ArticleEditor({ open, initial, saving, onClose, onSave }: ArticleEditorProps) {
  const [titulo, setTitulo] = useState("");
  const [resumen, setResumen] = useState("");
  const [categoria, setCategoria] = useState("");
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [adjuntos, setAdjuntos] = useState<ForoAdjunto[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Highlight,
      Placeholder.configure({ placeholder: "Escribe el contenido del artículo…" }),
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
          "prose prose-sm max-w-none dark:prose-invert min-h-[260px] focus:outline-none [&_table]:w-full [&_td]:border [&_th]:border [&_td]:border-[var(--border)] [&_th]:border-[var(--border)] [&_td]:p-2 [&_th]:p-2",
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
    editor?.commands.setContent(initial?.contenido ?? "");
  }, [open, initial, editor]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !etiquetas.includes(t) && etiquetas.length < 20) setEtiquetas((e) => [...e, t]);
    setTagInput("");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setAttachError(null);
    for (const file of Array.from(files)) {
      if (adjuntos.length >= 10) { setAttachError("Máximo 10 adjuntos por artículo"); break; }
      if (file.size > MAX_ADJUNTO_BYTES) { setAttachError(`"${file.name}" supera el límite de 5MB`); continue; }
      if (!ACCEPTED_MIME.test(file.type)) { setAttachError(`Tipo de archivo no permitido: ${file.name}`); continue; }
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
          <DialogTitle>{initial ? "Editar artículo" : "Nuevo artículo"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--muted-foreground)]">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del artículo" />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--muted-foreground)]">Resumen (opcional)</label>
            <Textarea
              value={resumen}
              onChange={(e) => setResumen(e.target.value)}
              placeholder="Breve resumen ejecutivo del artículo"
              className="min-h-[60px] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[var(--muted-foreground)]">Categoría</label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="p.ej. Seguridad" />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[var(--muted-foreground)]">Etiquetas</label>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                onBlur={addTag}
                placeholder="Escribe y presiona Enter"
              />
            </div>
          </div>

          {etiquetas.length > 0 && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {etiquetas.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12px] text-[var(--foreground)]">
                  {tag}
                  <button type="button" onClick={() => setEtiquetas((e) => e.filter((t) => t !== tag))} aria-label={`Quitar etiqueta ${tag}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--muted-foreground)]">Contenido</label>
            <div className="rounded-[12px] border border-[var(--border)]">
              <Toolbar editor={editor} />
              <div className="max-h-[400px] overflow-y-auto px-3 py-2">
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[12px] font-medium text-[var(--muted-foreground)]">Adjuntos</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:opacity-80"
              >
                <Paperclip className="size-3.5" /> Agregar archivo
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
                    <button type="button" onClick={() => setAdjuntos((prev) => prev.filter((_, idx) => idx !== i))} aria-label={`Quitar adjunto ${a.nombre}`}>
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="secondary" onClick={() => submit("borrador")} disabled={saving || !titulo.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />} Guardar borrador
          </Button>
          <Button onClick={() => submit("publicado")} disabled={saving || !titulo.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />} Publicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
