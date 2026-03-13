import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
import api from "../services/api/axiosInstance";

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

      const res = await api.get("/notification");

      if (res?.success) {
        const list = res.data || [];
        setNotifications(list);
        setUnreadCount(computeUnread(list));
      }
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

  // Optional: auto-refresh every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshNotifications();
    }, 20000);

    return () => clearInterval(interval);
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