import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { axiosInstance } from "../services/api";
import { EmptyState } from "../components";
import { useTheme } from "../context/ThemeContext";

const normalizeNotification = (item) => ({
  id: item.id || item.Id,
  title: item.title || item.Title || "Notification",
  message: item.message || item.Message || "",
  type: item.type || item.Type || "Info",
  isRead: item.isRead ?? item.IsRead ?? false,
  createdAt: item.createdAt || item.CreatedAt || null,
});

const formatNotificationTime = (isoDate) => {
  if (!isoDate) return "";

  const d = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: now.getFullYear() !== d.getFullYear() ? "numeric" : undefined,
  });
};

const NotificationsScreen = () => {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const styles = useMemo(
    () =>
      createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows]
  );

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [filter, setFilter] = useState("All");

  const getNotifBg = (type) => {
    switch (String(type || "").toLowerCase()) {
      case "success":
        return colors.successLight;
      case "warning":
        return colors.warningLight;
      case "error":
        return colors.errorLight;
      default:
        return colors.surfaceMuted;
    }
  };

  const getTypePill = (type) => {
    switch (String(type || "").toLowerCase()) {
      case "success":
        return { bg: colors.success, text: "SUCCESS" };
      case "warning":
        return { bg: colors.warning, text: "WARNING" };
      case "error":
        return { bg: colors.error, text: "ERROR" };
      default:
        return { bg: colors.info, text: "INFO" };
    }
  };

  const getTypeIcon = (type) => {
    switch (String(type || "").toLowerCase()) {
      case "success":
        return "checkmark-circle";
      case "warning":
        return "warning";
      case "error":
        return "close-circle";
      default:
        return "information-circle";
    }
  };

  const getTypeIconColor = (type) => {
    switch (String(type || "").toLowerCase()) {
      case "success":
        return colors.success;
      case "warning":
        return colors.warning;
      case "error":
        return colors.error;
      default:
        return colors.info;
    }
  };

  const loadNotifications = async (showLoader = true) => {
    if (showLoader) setLoading(true);

    try {
      const res = await axiosInstance.get("/Notifications");
      const success = res?.data?.success ?? res?.success;

      if (!success) {
        setNotifications([]);
        return;
      }

      const list = res?.data?.data || res?.data || res?.data?.items || res?.data?.notifications || res?.data || [];
      const normalized = Array.isArray(list)
        ? list.map(normalizeNotification)
        : [];

      setNotifications(normalized);
    } catch (err) {
      console.log("Notification error:", err?.response?.data || err.message);
      setNotifications([]);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadNotifications(false);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return;

    setMarkingAllRead(true);
    try {
      await axiosInstance.put("/Notifications/read-all");

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          isRead: true,
        }))
      );

      await loadNotifications(false);
    } catch (err) {
      console.log(
        "Notification mark-all error:",
        err?.response?.data || err.message
      );
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationPress = async (item) => {
    if (item.isRead) return;

    // optimistic local update
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === item.id ? { ...notif, isRead: true } : notif
      )
    );

    // if your backend later supports single-read endpoint,
    // replace this with that endpoint.
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications(true);
    }, [])
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (filter === "Unread") {
      return notifications.filter((item) => !item.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Notifications</Text>
          <Text style={styles.screenSubtitle}>
            Stay updated with your latest activity
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.markAllButton,
            (markingAllRead || unreadCount === 0) && styles.markAllButtonDisabled,
          ]}
          activeOpacity={0.85}
          onPress={handleMarkAllAsRead}
          disabled={markingAllRead || unreadCount === 0}
        >
          <Text style={styles.markAllButtonText}>
            {markingAllRead ? "Marking..." : "Mark all read"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {["All", "Unread"].map((item) => {
          const selected = filter === item;
          const count =
            item === "All" ? notifications.length : unreadCount;

          return (
            <TouchableOpacity
              key={item}
              style={[
                styles.filterChip,
                selected && styles.filterChipActive,
              ]}
              activeOpacity={0.85}
              onPress={() => setFilter(item)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selected && styles.filterChipTextActive,
                ]}
              >
                {item} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filteredNotifications.length === 0 ? (
        <EmptyState
          iconName="notifications-outline"
          title={
            filter === "Unread" ? "No unread notifications" : "No notifications"
          }
          subtitle={
            filter === "Unread"
              ? "You're all caught up."
              : "You're all caught up!"
          }
        />
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const unread = !item.isRead;
            const pill = getTypePill(item.type);

            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handleNotificationPress(item)}
                style={[
                  styles.card,
                  {
                    backgroundColor: getNotifBg(item.type),
                    opacity: unread ? 1 : 0.75,
                  },
                ]}
              >
                <View style={styles.rowTop}>
                  <View style={styles.leftTop}>
                    {unread && <View style={styles.unreadDot} />}

                    <Ionicons
                      name={getTypeIcon(item.type)}
                      size={18}
                      color={getTypeIconColor(item.type)}
                      style={styles.typeIcon}
                    />

                    <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                      <Text style={styles.pillText}>{pill.text}</Text>
                    </View>
                  </View>

                  <Text style={styles.timeText}>
                    {formatNotificationTime(item.createdAt)}
                  </Text>
                </View>

                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>

                <Text style={styles.message} numberOfLines={3}>
                  {item.message}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const createStyles = (
  colors,
  spacing,
  borderRadius,
  typography,
  shadows
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
    },

    loadingText: {
      marginTop: spacing.md,
      fontSize: typography.base,
      color: colors.textSecondary,
    },

    header: {
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },

    screenTitle: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: colors.text,
    },

    screenSubtitle: {
      marginTop: spacing.xs,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    markAllButton: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      ...shadows.sm,
    },

    markAllButtonDisabled: {
      opacity: 0.55,
    },

    markAllButtonText: {
      color: colors.textOnPrimary,
      fontSize: typography.sm,
      fontWeight: typography.bold,
    },

    filterRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
    },

    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },

    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    filterChipText: {
      fontSize: typography.sm,
      color: colors.text,
      fontWeight: typography.semibold,
    },

    filterChipTextActive: {
      color: colors.textOnPrimary,
    },

    listContent: {
      paddingVertical: spacing.sm,
      paddingBottom: spacing.xl,
    },

    card: {
      marginHorizontal: spacing.lg,
      marginVertical: spacing.sm,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },

    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },

    leftTop: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
    },

    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginRight: spacing.sm,
    },

    typeIcon: {
      marginRight: spacing.sm,
    },

    pill: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
    },

    pillText: {
      color: colors.textOnPrimary,
      fontWeight: typography.bold,
      fontSize: 11,
      letterSpacing: 0.3,
    },

    timeText: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      fontWeight: typography.semibold,
    },

    title: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    message: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });

export default NotificationsScreen;