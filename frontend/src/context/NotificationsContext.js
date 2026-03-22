import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
import { notificationService } from "../services/api";

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const computeUnread = (list) =>
    list.reduce((acc, n) => acc + (n.isRead ? 0 : 1), 0);

  const refreshNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await notificationService.getNotifications();
      const list = res?.data || [];
      setNotifications(list);
      setUnreadCount(computeUnread(list));
    } catch (err) {
      console.log("Notification load error:", err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load notifications once when provider mounts
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refreshNotifications,
    }),
    [notifications, unreadCount, loading, refreshNotifications]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}