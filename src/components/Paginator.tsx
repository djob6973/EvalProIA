type PaginatorProps = {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
};

export function Paginator({ page, total, pageSize, onPage }: PaginatorProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function pageNumbers(): (number | "…")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const items: (number | "…")[] = [1];
    if (page > 3) items.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) items.push(i);
    if (page < totalPages - 2) items.push("…");
    items.push(totalPages);
    return items;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-[12px] text-[var(--muted-foreground)]">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--secondary)] disabled:opacity-40"
        >
          ← Anterior
        </button>
        {pageNumbers().map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-[12px] text-[var(--muted-foreground)]">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className="min-w-[32px] rounded-lg border px-2 py-1.5 text-[12px] font-medium transition"
              style={
                p === page
                  ? { background: "#ED5650", color: "#fff", borderColor: "#ED5650" }
                  : { borderColor: "var(--border)", color: "var(--muted-foreground)", background: "transparent" }
              }
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--secondary)] disabled:opacity-40"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
