import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { notificationsService, DbNotification } from "@/lib/services/notifications";
import { statsService } from "@/lib/services/stats";

export interface NotifItem {
  id: string;
  live: boolean;
  text: string;
  meta: string;
  read: boolean;
  timestamp: string;
}

interface NotificationContextValue {
  items: NotifItem[];
  unreadCount: number;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  items: [],
  unreadCount: 0,
  markAllAsRead: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

// Participant and "both" roles get DB-backed personal notifications.
// All admin roles use the activity feed with localStorage-based read tracking.
function isParticipantLike(role: string | undefined): boolean {
  return role === "participant" || role === "both";
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const participantMode = isParticipantLike(profile?.role);

  const [dbItems, setDbItems] = useState<DbNotification[]>([]);
  const [activityItems, setActivityItems] = useState<any[]>([]);
  const [lastReadAt, setLastReadAt] = useState<Date | null>(null);

  // Load persisted lastReadAt for activity mode
  useEffect(() => {
    if (!participantMode) {
      const stored = localStorage.getItem("ep-notif-read-at");
      setLastReadAt(stored ? new Date(stored) : null);
    }
  }, [participantMode]);

  // Poll DB notifications for participants
  useEffect(() => {
    if (!profile || !participantMode) return;

    const load = () => {
      notificationsService.getMyNotifications().then(setDbItems).catch(() => {});
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [profile?.id, participantMode]);

  // Poll activity feed for admin roles
  useEffect(() => {
    if (!profile || participantMode) return;

    const load = () => {
      statsService.getRecentActivity(20).then(setActivityItems).catch(() => {});
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [profile?.id, participantMode]);

  const items: NotifItem[] = participantMode
    ? dbItems.map((n) => ({
        id: n.id,
        live: !n.read,
        text: n.title,
        meta: n.body ?? "",
        read: n.read,
        timestamp: n.created_at,
      }))
    : activityItems.map((a) => ({
        id: `${a.type}-${a.timestamp}`,
        live: a.type === "result",
        text: a.text,
        meta: a.meta,
        read: lastReadAt ? new Date(a.timestamp) <= lastReadAt : false,
        timestamp: a.timestamp,
      }));

  const unreadCount = items.filter((n) => !n.read).length;

  const markAllAsRead = async () => {
    if (participantMode) {
      await notificationsService.markAllRead().catch(() => {});
      setDbItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } else {
      const now = new Date().toISOString();
      localStorage.setItem("ep-notif-read-at", now);
      setLastReadAt(new Date(now));
    }
  };

  return (
    <NotificationContext.Provider value={{ items, unreadCount, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}
