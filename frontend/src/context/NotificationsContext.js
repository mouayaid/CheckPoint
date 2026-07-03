import logger from "../utils/logger";
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
import { notificationService } from "../services/api";
import { useSignalRNotifications } from "../hooks/useSignalRNotifications";
import { useAuth } from "./AuthContext";
import { useE2eMode } from "./E2eModeContext";

const NotificationsContext = createContext(null);

const getNotificationId = (notification) => notification?.id ?? notification?.Id;

export function NotificationsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const isE2e = useE2eMode();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const isNotificationRead = useCallback((notification) => {
    return (
      notification?.isRead === true ||
      notification?.IsRead === true ||
      notification?.read === true ||
      notification?.Read === true
    );
  }, []);

  const computeUnread = useCallback(
    (list) => list.reduce((acc, n) => acc + (isNotificationRead(n) ? 0 : 1), 0),
    [isNotificationRead],
  );

  const refreshNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await notificationService.getNotifications();
      const list = res?.data?.data || res?.data || [];
      setNotifications(list);
      setUnreadCount(computeUnread(list));
    } catch (err) {
      logger.debug(
        "Notification load error:",
        err?.response?.data || err.message,
      );
    } finally {
      setLoading(false);
    }
  }, [computeUnread]);

  useEffect(() => {
    if (!isAuthenticated || isE2e) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    refreshNotifications();
  }, [isAuthenticated, isE2e, refreshNotifications]);

  const handleSignalRNotification = useCallback((notification) => {
    const notificationId = getNotificationId(notification);

    setNotifications((prev) => {
      const exists =
        notificationId !== undefined &&
        notificationId !== null &&
        prev.some((item) => getNotificationId(item) === notificationId);

      if (exists) {
        return prev;
      }

      const next = [notification, ...prev];
      setUnreadCount(computeUnread(next));
      return next;
    });
  }, [computeUnread]);

  useSignalRNotifications(handleSignalRNotification, isAuthenticated && !isE2e);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refreshNotifications,
    }),
    [notifications, unreadCount, loading, refreshNotifications],
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
