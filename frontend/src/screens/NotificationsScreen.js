import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../components";
import { useNotifications } from "../context/NotificationsContext";
import { useTheme } from "../context/ThemeContext";
import { parseApiInstant } from "../utils/helpers";

const formatNotificationTime = (isoDate) => {
  if (!isoDate) return "";

  const d = parseApiInstant(isoDate);
  if (!d || Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - d.getTime());

  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "À l’instant";
  if (mins < 60) return `il y a ${mins} min`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) return `il y a ${days} j`;

  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: now.getFullYear() !== d.getFullYear() ? "numeric" : undefined,
  });
};

const NotificationsScreen = () => {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const {
    notifications,
    unreadCount,
    loading,
    error: notificationError,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const styles = useMemo(
    () =>
      createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows]
  );

  const [refreshing, setRefreshing] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState(null);

  const filterLabel = (key) => {
    switch (key) {
      case "All":
        return "Tout";
      case "Unread":
        return "Non lues";
      default:
        return key;
    }
  };

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
        return { bg: colors.success, text: "SUCCÈS" };
      case "warning":
        return { bg: colors.warning, text: "AVERT." };
      case "error":
        return { bg: colors.error, text: "ERREUR" };
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

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      setError(null);
      await refreshNotifications({ showLoader: false });
    } catch {
      setError("Impossible de charger les notifications.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return;

    setMarkingAllRead(true);
    try {
      setError(null);
      await markAllAsRead();
    } catch (err) {
      console.log(
        "Notification mark-all error:",
        err?.response?.data || err.message
      );
      setError("Impossible de marquer les notifications comme lues.");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationPress = async (item) => {
    try {
      setError(null);

      if (!item.isRead) {
        await markAsRead(item.id);
      }
    } catch (err) {
      console.log("Notification press error:", err?.message);
      setError("Impossible de marquer cette notification comme lue.");
    }
  };

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
        <Text style={styles.loadingText}>Chargement des notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
            {markingAllRead ? "Marquage..." : "Tout marquer comme lu"}
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
                {filterLabel(item)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filteredNotifications.length === 0 ? (
        <EmptyState
          iconName="notifications-outline"
          title={
            error ||
            notificationError ||
            (filter === "Unread"
              ? "Aucune notification non lue"
              : "Aucune notification")
          }
          subtitle={
            error || notificationError
              ? "Veuillez reessayer plus tard."
              : filter === "Unread"
              ? "Vous êtes à jour."
              : "Vous êtes à jour !"
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
