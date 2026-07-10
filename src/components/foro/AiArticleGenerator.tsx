import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Sparkles, Loader2, FileText, X } from "lucide-react";
import { extractTextWithOCR } from "@/lib/services/openai";
import { generateForoArticuloFn } from "@/lib/services/openai-server";
import { ForoArticuloInput } from "@/lib/services/foro";

interface AiArticleGeneratorProps {
  open: boolean;
  onClose: () => void;
  onGenerated: (draft: ForoArticuloInput) => void;
}

export function AiArticleGenerator({ open, onClose, onGenerated }: AiArticleGeneratorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "extracting" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = status !== "idle";

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!/\.(pdf|docx|txt)$/i.test(f.name)) {
      setError("Formato no soportado. Usa PDF, DOCX o TXT.");
      return;
    }
    setError(null);
    setFile(f);
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setError(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const generate = async () => {
    if (!file) return;
    setError(null);
    try {
      setStatus("extracting");
      const extractedText = await extractTextWithOCR(file);

      setStatus("generating");
      const result = await generateForoArticuloFn({ data: { extractedText } });

      const etiquetas = Array.from(
        new Set([...(result.etiquetas_sugeridas ?? []), ...(result.palabras_clave ?? [])]),
      ).slice(0, 20);

      onGenerated({
        titulo: result.titulo,
        contenido: result.contenido,
        resumen: result.resumen || null,
        categoria: result.categoria_sugerida || null,
        etiquetas,
        estado: "borrador",
        origen: "ia",
      });
      reset();
    } catch (e: any) {
      setError(e.message ?? "No se pudo generar el artículo");
      setStatus("idle");
    }
  };

  const statusLabel =
    status === "extracting" ? "Extrayendo texto del documento…" : "Generando artículo con IA…";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Generar artículo con IA
          </DialogTitle>
        </DialogHeader>

        <p className="text-[13px] text-[var(--muted-foreground)]">
          Sube un documento corporativo (manual, guía o política) y la IA generará un artículo estructurado
          preservando el 100% del contenido original. Podrás revisar y editar antes de publicar.
        </p>

        {!file ? (
          <label className="group flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5">
            <Upload className="mb-2 size-6" />
            <span className="text-sm font-semibold">Haz clic para elegir un archivo</span>
            <span className="mt-1 text-[10px]">PDF, DOCX o TXT</span>
            <input
              type="file"
              hidden
              accept=".pdf,.docx,.txt"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <div className="flex items-center justify-between rounded-[10px] bg-[var(--surface-2)] px-3 py-2.5 text-[13px]">
            <span className="flex items-center gap-2 truncate">
              <FileText className="size-4 shrink-0" /> {file.name}
            </span>
            {!busy && (
              <button type="button" onClick={() => setFile(null)}>
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {error && <p className="text-[12px] text-destructive">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={generate} disabled={!file || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {busy ? statusLabel : "Generar artículo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
