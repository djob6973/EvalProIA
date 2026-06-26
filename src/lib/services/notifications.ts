export interface DbNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const r = await fetch(path, opts);
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error((err as any).error || r.statusText);
  }
  return r.json();
}

export const notificationsService = {
  async getMyNotifications(): Promise<DbNotification[]> {
    return apiFetch("/api/data/notifications");
  },

  async markAllRead(): Promise<void> {
    await apiFetch("/api/data/notifications/read-all", { method: "POST" });
  },
};
