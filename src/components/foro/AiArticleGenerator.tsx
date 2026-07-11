import { useState } from "react";
import { useTranslation } from "react-i18next";
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

function defaultIdioma(lang: string): string {
  if (lang.startsWith("en")) return "Inglés";
  if (lang.startsWith("pt")) return "Portugués";
  return "Español";
}

export function AiArticleGenerator({ open, onClose, onGenerated }: AiArticleGeneratorProps) {
  const { t, i18n } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [idioma, setIdioma] = useState(() => defaultIdioma(i18n.language));
  const [status, setStatus] = useState<"idle" | "extracting" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = status !== "idle";

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!/\.(pdf|docx|txt)$/i.test(f.name)) {
      setError(t("forum.aiFileTypeError"));
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
      const result = await generateForoArticuloFn({ data: { extractedText, idioma } });

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
      setError(e.message ?? t("forum.aiGenerateError"));
      setStatus("idle");
    }
  };

  const statusLabel = status === "extracting" ? t("forum.aiExtracting") : t("forum.aiGenerating");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> {t("forum.aiModalTitle")}
          </DialogTitle>
        </DialogHeader>

        <p className="text-[13px] text-[var(--muted-foreground)]">{t("forum.aiModalDesc")}</p>

        {!file ? (
          <label className="group flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5">
            <Upload className="mb-2 size-6" />
            <span className="text-sm font-semibold">{t("forum.aiDropzone")}</span>
            <span className="mt-1 text-[10px]">{t("forum.aiFileTypes")}</span>
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
              <button type="button" onClick={() => setFile(null)} aria-label={t("forum.removeFile")}>
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-[12px] font-medium text-[var(--muted-foreground)]">{t("generate.language")}</label>
          <select
            value={idioma}
            onChange={(e) => setIdioma(e.target.value)}
            disabled={busy}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="Español">{t("generate.spanish")}</option>
            <option value="Inglés">{t("generate.english")}</option>
            <option value="Portugués">{t("generate.portuguese")}</option>
          </select>
        </div>

        {error && <p className="text-[12px] text-destructive">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            {t("forum.cancel")}
          </Button>
          <Button onClick={generate} disabled={!file || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {busy ? statusLabel : t("forum.aiGenerateButton")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
