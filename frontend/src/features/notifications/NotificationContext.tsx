import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useBadgeToast } from "../../hooks/useBadgeToast";
import { BADGES } from "../../constants/badges";
import api from "../../api";

export interface AppNotification {
  id: number;
  notif_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender_username?: string | null;
  meta: Record<string, unknown>;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  toasts: any[];
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function getNotificationsWsUrl(): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
  const host = apiBase.replace(/^https?:\/\//, "").replace(/\/api\/?$/, "");
  const scheme = apiBase.startsWith("https") ? "wss" : "ws";
  return `${scheme}://${host}/ws/notifications/`;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toasts, addToast, addDynamicToast, dismissToast } = useBadgeToast(BADGES);

  // Initial fetch for notifications list
  const { data: notifications = [], isLoading } = useQuery<AppNotification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get("/notifications/");
      return res.data;
    },
    enabled: !!user && !user.is_staff, // Staff users don't use this notification system typically
  });

  const [wsUnreadCount, setWsUnreadCount] = useState<number>(0);
  
  // Calculate unread count (prefer websocket count, fallback to local array count)
  const unreadCount = useMemo(() => {
    return Math.max(
      wsUnreadCount,
      notifications.filter((n) => !n.is_read).length
    );
  }, [wsUnreadCount, notifications]);

  // Auth token for WS
  let token: string | null = null;
  try {
    token = localStorage.getItem("accessToken");
  } catch {
    /* localStorage unavailable */
  }

  const { send: sendMessage } = useWebSocket({
    url: getNotificationsWsUrl(),
    token: user && !user.is_staff ? token : null,
    onMessage: (data: unknown) => {
      const msg = data as Record<string, unknown>;
      
      if (msg?.type === "connection_established") {
        setWsUnreadCount(typeof msg.unread_count === "number" ? msg.unread_count : 0);
      }
      
      if (msg?.type === "notification") {
        const notif = msg.notification as AppNotification;
        
        // Update local React Query cache
        queryClient.setQueryData<AppNotification[]>(["notifications"], (oldData = []) => {
          // Prepend new notification
          return [notif, ...oldData.filter(n => n.id !== notif.id)];
        });
        
        setWsUnreadCount((prev) => prev + 1);

        // Handle toast popups for specific types
        const notifType = notif?.notif_type;
        if (notifType === "badge") {
          const slug = notif.meta?.badge_slug as string | undefined;
          if (slug) addToast(slug);
        } else if (notifType === "achievement") {
          if (notif.meta) {
            addDynamicToast({
              id: notif.meta.achievement_slug as string,
              name: notif.title,
              icon: (notif.meta.icon as string) || "🏆",
              desc: notif.message,
            });
          }
        }
      }
      
      if (msg?.type === "marked_read") {
        const id = msg.notification_id as number;
        queryClient.setQueryData<AppNotification[]>(["notifications"], (oldData = []) => {
          return oldData.map(n => n.id === id ? { ...n, is_read: true } : n);
        });
        setWsUnreadCount((prev) => Math.max(0, prev - 1));
      }
    },
  });

  const markAsRead = useCallback(async (id: number) => {
    if (!user || user.is_staff) return;
    
    // Optimistic update
    queryClient.setQueryData<AppNotification[]>(["notifications"], (oldData = []) => {
      return oldData.map(n => n.id === id ? { ...n, is_read: true } : n);
    });
    setWsUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      // Use WS to mark read if possible, fallback to REST
      sendMessage({ action: "mark_read", notification_id: id });
      await api.post(`/notifications/${id}/read/`);
    } catch (error) {
      console.error("Failed to mark notification as read", error);
      // Let React Query refetch to sync correct state
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [user, sendMessage, queryClient]);

  const markAllAsRead = useCallback(async () => {
    if (!user || user.is_staff) return;
    
    // Optimistic update
    queryClient.setQueryData<AppNotification[]>(["notifications"], (oldData = []) => {
      return oldData.map(n => ({ ...n, is_read: true }));
    });
    setWsUnreadCount(0);

    try {
      await api.post(`/notifications/mark-all-read/`);
    } catch (error) {
      console.error("Failed to mark all as read", error);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [user, queryClient]);

  const value = {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    toasts,
    dismissToast,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
