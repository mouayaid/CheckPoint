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

const notificationIdsEqual = (left, right) =>
  left !== undefined &&
  left !== null &&
  right !== undefined &&
  right !== null &&
  String(left) === String(right);

const normalizeNotification = (item) => ({
  ...item,
  id: item?.id ?? item?.Id,
  title: item?.title ?? item?.Title ?? "Notification",
  message: item?.message ?? item?.Message ?? item?.content ?? item?.Content ?? "",
  type: item?.type ?? item?.Type ?? "Info",
  isRead: item?.isRead ?? item?.IsRead ?? item?.read ?? item?.Read ?? false,
  createdAt:
    item?.createdAt ??
    item?.CreatedAt ??
    item?.dateCreation ??
    item?.DateCreation ??
    null,
});

const deduplicateNotifications = (list) => {
  const seen = new Set();

  return list.filter((notification) => {
    const id = getNotificationId(notification);
    if (id === undefined || id === null) return true;

    const key = String(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const extractNotificationList = (response) => {
  const list =
    response?.data?.data ??
    response?.data ??
    response?.items ??
    response?.notifications ??
    [];

  return Array.isArray(list)
    ? deduplicateNotifications(list.map(normalizeNotification))
    : [];
};

export function NotificationsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const isE2e = useE2eMode();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const unreadCount = useMemo(
    () => notifications.reduce((count, item) => count + (item.isRead ? 0 : 1), 0),
    [notifications],
  );

  const refreshNotifications = useCallback(async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) setLoading(true);
      setError(null);
      const res = await notificationService.getNotifications();
      const success = res?.data?.success ?? res?.success;
      if (success === false) {
        throw new Error(res?.message || "Impossible de charger les notifications.");
      }

      const list = extractNotificationList(res);
      setNotifications((current) => {
        const fetchedIds = new Set(
          list
            .map(getNotificationId)
            .filter((id) => id !== undefined && id !== null)
            .map(String),
        );
        const liveOnly = current.filter((item) => {
          const id = getNotificationId(item);
          return id === undefined || id === null || !fetchedIds.has(String(id));
        });

        return deduplicateNotifications([...liveOnly, ...list]).sort(
          (left, right) =>
            new Date(right.createdAt || 0).getTime() -
            new Date(left.createdAt || 0).getTime(),
        );
      });
      return list;
    } catch (err) {
      setError("Impossible de charger les notifications.");
      logger.debug(
        "Notification load error:",
        err?.response?.data || err.message,
      );
      throw err;
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(
    async (notificationId) => {
      const previousNotification = notifications.find((item) =>
        notificationIdsEqual(getNotificationId(item), notificationId),
      );

      setNotifications((current) =>
        current.map((item) =>
          notificationIdsEqual(getNotificationId(item), notificationId)
            ? { ...item, isRead: true }
            : item,
        ),
      );

      if (!previousNotification || previousNotification.isRead) return;

      try {
        await notificationService.markAsRead(notificationId);
      } catch (err) {
        try {
          await refreshNotifications({ showLoader: false });
        } catch {
          setNotifications((current) =>
            current.map((item) =>
              notificationIdsEqual(getNotificationId(item), notificationId)
                ? previousNotification
                : item,
            ),
          );
        }
        throw err;
      }
    },
    [notifications, refreshNotifications],
  );

  const markAllAsRead = useCallback(async () => {
    const previousNotifications = notifications;

    setNotifications((current) =>
      current.map((item) => ({ ...item, isRead: true })),
    );

    if (!previousNotifications.some((item) => !item.isRead)) return;

    try {
      await notificationService.markAllAsRead();
    } catch (err) {
      try {
        await refreshNotifications({ showLoader: false });
      } catch {
        const previousById = new Map(
          previousNotifications
            .map((item) => [getNotificationId(item), item])
            .filter(([id]) => id !== undefined && id !== null)
            .map(([id, item]) => [String(id), item]),
        );

        setNotifications((current) =>
          current.map((item) => {
            const id = getNotificationId(item);
            return id !== undefined && id !== null
              ? previousById.get(String(id)) ?? item
              : item;
          }),
        );
      }
      throw err;
    }
  }, [notifications, refreshNotifications]);

  useEffect(() => {
    if (!isAuthenticated || isE2e) {
      setNotifications([]);
      setError(null);
      return;
    }

    refreshNotifications().catch(() => {});
  }, [isAuthenticated, isE2e, refreshNotifications]);

  const handleSignalRNotification = useCallback((notification) => {
    const normalized = normalizeNotification(notification);
    const notificationId = getNotificationId(normalized);

    setNotifications((prev) => {
      const exists =
        notificationId !== undefined &&
        notificationId !== null &&
        prev.some((item) =>
          notificationIdsEqual(getNotificationId(item), notificationId),
        );

      if (exists) {
        return prev;
      }

      return [normalized, ...prev];
    });
  }, []);

  useSignalRNotifications(handleSignalRNotification, isAuthenticated && !isE2e);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      refreshNotifications,
      markAsRead,
      markAllAsRead,
    }),
    [
      notifications,
      unreadCount,
      loading,
      error,
      refreshNotifications,
      markAsRead,
      markAllAsRead,
    ],
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
