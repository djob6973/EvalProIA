import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageCircle, Pencil, Trash2, Send, Loader2, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { foroService, ForoComentario } from "@/lib/services/foro";

interface Participant {
  id: string;
  full_name: string | null;
  email: string;
}

interface CommentThreadProps {
  articuloId: string;
  currentUserId: string;
  canModerateAny: boolean;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function MentionPicker({
  participants,
  query,
  onPick,
}: {
  participants: Participant[];
  query: string;
  onPick: (p: Participant) => void;
}) {
  const filtered = useMemo(
    () =>
      participants
        .filter((p) => (p.full_name ?? p.email).toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6),
    [participants, query],
  );
  if (filtered.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 z-20 mb-1 w-64 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
      {filtered.map((p) => (
        <button
          key={p.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(p); }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-2)]"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
            {(p.full_name ?? p.email).slice(0, 1).toUpperCase()}
          </span>
          {p.full_name ?? p.email}
        </button>
      ))}
    </div>
  );
}

function useMentionInput(participants: Participant[]) {
  const [text, setText] = useState("");
  const [mentioned, setMentioned] = useState<Participant[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const onChange = (val: string) => {
    setText(val);
    const match = /@([^\s@]*)$/.exec(val);
    setMentionQuery(match ? match[1] : null);
  };

  const pick = (p: Participant) => {
    setText((t) => t.replace(/@([^\s@]*)$/, `@${p.full_name ?? p.email} `));
    setMentioned((m) => (m.some((x) => x.id === p.id) ? m : [...m, p]));
    setMentionQuery(null);
  };

  const reset = () => { setText(""); setMentioned([]); setMentionQuery(null); };

  return { text, setText: onChange, mentioned, mentionQuery, pick, reset };
}

function CommentComposer({
  participants,
  placeholder,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
  autoFocus,
}: {
  participants: Participant[];
  placeholder: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (contenido: string, mentionIds: string[]) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const { text, setText, mentioned, mentionQuery, pick, reset } = useMentionInput(participants);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (autoFocus) textareaRef.current?.focus(); }, [autoFocus]);

  const submit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim(), mentioned.map((m) => m.id));
    reset();
  };

  return (
    <div className="relative">
      {mentionQuery !== null && (
        <MentionPicker participants={participants} query={mentionQuery} onPick={pick} />
      )}
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="min-h-[70px] resize-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
          <AtSign className="size-3" /> Escribe @ para mencionar a alguien
        </span>
        <div className="flex gap-2">
          {onCancel && <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>}
          <Button size="sm" onClick={submit} disabled={submitting || !text.trim()}>
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SingleComment({
  comment,
  currentUserId,
  canModerateAny,
  onReply,
  onLike,
  onEdit,
  onDelete,
  isReply,
}: {
  comment: ForoComentario;
  currentUserId: string;
  canModerateAny: boolean;
  onReply?: () => void;
  onLike: () => void;
  onEdit: (contenido: string) => void;
  onDelete: () => void;
  isReply?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.contenido);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isOwner = comment.autor_id === currentUserId;

  return (
    <div className={isReply ? "ml-10 mt-3" : ""}>
      <div className="flex gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
          {(comment.autor_nombre ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="rounded-[14px] bg-[var(--surface-2)] px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--foreground)]">
              {comment.autor_nombre}
              <span className="font-normal text-[var(--muted-foreground)]">{formatDateTime(comment.created_at)}</span>
            </div>
            {editing ? (
              <div className="mt-1.5 flex flex-col gap-2">
                <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-[60px] resize-none" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                  <Button size="sm" onClick={() => { onEdit(editText.trim()); setEditing(false); }} disabled={!editText.trim()}>
                    Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-[var(--foreground)]">{comment.contenido}</p>
            )}
          </div>
          <div className="mt-1 flex items-center gap-4 pl-1 text-[12px] text-[var(--muted-foreground)]">
            <button
              type="button"
              onClick={onLike}
              aria-label={comment.liked_by_me ? "Quitar me gusta" : "Me gusta"}
              aria-pressed={comment.liked_by_me}
              className={`flex items-center gap-1 hover:opacity-80 ${comment.liked_by_me ? "text-[#ED5650]" : ""}`}
            >
              <Heart className={`size-3.5 ${comment.liked_by_me ? "fill-current" : ""}`} /> {comment.likes || ""}
            </button>
            {onReply && (
              <button type="button" onClick={onReply} className="flex items-center gap-1 hover:opacity-80">
                <MessageCircle className="size-3.5" /> Responder
              </button>
            )}
            {isOwner && (
              <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 hover:opacity-80">
                <Pencil className="size-3.5" /> Editar
              </button>
            )}
            {(isOwner || canModerateAny) && (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 hover:opacity-80">
                <Trash2 className="size-3.5" /> Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar comentario"
        description="Esta acción no se puede deshacer."
        variant="destructive"
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export function CommentThread({ articuloId, currentUserId, canModerateAny }: CommentThreadProps) {
  const [comments, setComments] = useState<ForoComentario[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const load = () => foroService.getComentarios(articuloId).then(setComments).catch(() => {});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      foroService.getComentarios(articuloId),
      fetch("/api/data/participants").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([c, p]) => { setComments(c); setParticipants(p); })
      .finally(() => setLoading(false));
  }, [articuloId]);

  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  const postComment = async (contenido: string, mentions: string[], parent_id?: string) => {
    setPosting(true);
    try {
      await foroService.createComentario({ articulo_id: articuloId, contenido, mentions, parent_id });
      setReplyingTo(null);
      await load();
    } finally {
      setPosting(false);
    }
  };

  const editComment = async (id: string, contenido: string) => {
    await foroService.updateComentario(id, { contenido });
    await load();
  };

  const deleteComment = async (id: string) => {
    await foroService.deleteComentario(id);
    await load();
  };

  const likeComment = async (id: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, liked_by_me: !c.liked_by_me, likes: c.likes + (c.liked_by_me ? -1 : 1) } : c)),
    );
    try {
      await foroService.toggleLike(id);
    } catch {
      await load();
    }
  };

  if (loading) return <p className="text-[13px] text-[var(--muted-foreground)]">Cargando comentarios…</p>;

  return (
    <div className="flex flex-col gap-5">
      <h3 className="font-display text-[18px] font-medium text-[var(--foreground)]">
        Comentarios ({comments.length})
      </h3>

      <CommentComposer
        participants={participants}
        placeholder="Escribe un comentario…"
        submitLabel="Comentar"
        submitting={posting}
        onSubmit={(contenido, mentions) => postComment(contenido, mentions)}
      />

      <div className="flex flex-col gap-4">
        {roots.map((root) => (
          <div key={root.id}>
            <SingleComment
              comment={root}
              currentUserId={currentUserId}
              canModerateAny={canModerateAny}
              onReply={() => setReplyingTo(replyingTo === root.id ? null : root.id)}
              onLike={() => likeComment(root.id)}
              onEdit={(c) => editComment(root.id, c)}
              onDelete={() => deleteComment(root.id)}
            />
            {repliesOf(root.id).map((reply) => (
              <SingleComment
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                canModerateAny={canModerateAny}
                onLike={() => likeComment(reply.id)}
                onEdit={(c) => editComment(reply.id, c)}
                onDelete={() => deleteComment(reply.id)}
                isReply
              />
            ))}
            {replyingTo === root.id && (
              <div className="ml-10 mt-3">
                <CommentComposer
                  participants={participants}
                  placeholder={`Responder a ${root.autor_nombre}…`}
                  submitLabel="Responder"
                  submitting={posting}
                  autoFocus
                  onCancel={() => setReplyingTo(null)}
                  onSubmit={(contenido, mentions) => postComment(contenido, mentions, root.id)}
                />
              </div>
            )}
          </div>
        ))}
        {roots.length === 0 && (
          <p className="text-[13px] text-[var(--muted-foreground)]">Sé el primero en comentar.</p>
        )}
      </div>
    </div>
  );
}
