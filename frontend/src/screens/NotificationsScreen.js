import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api/axiosInstance";
import { EmptyState } from "../components";
import { Ionicons } from "@expo/vector-icons";

const getNotifBg = (type) => {
  switch (type) {
    case "Success":
      return "#E8F5E9";
    case "Warning":
      return "#FFF3E0";
    case "Error":
      return "#FFEBEE";
    default:
      return "#F5F5F5"; // Info / others
  }
};

const getTypePill = (type) => {
  switch (type) {
    case "Success":
      return { bg: "#2E7D32", text: "SUCCESS" };
    case "Warning":
      return { bg: "#EF6C00", text: "WARNING" };
    case "Error":
      return { bg: "#C62828", text: "ERROR" };
    default:
      return { bg: "#1565C0", text: "INFO" };
  }
};
const getTypeIcon = (type) => {
  switch (type) {
    case "Success":
      return "checkmark-circle";
    case "Warning":
      return "warning";
    case "Error":
      return "close-circle";
    default:
      return "information-circle";
  }
};

const getTypeIconColor = (type) => {
  switch (type) {
    case "Success":
      return "#2E7D32";
    case "Warning":
      return "#EF6C00";
    case "Error":
      return "#C62828";
    default:
      return "#1565C0";
  }
};

// small relative time formatter (no libs)
const timeAgo = (isoDate) => {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = async () => {
    try {
      const res = await api.get("/Notifications");
      if (res.success) {
        const list = res.data || [];
        setNotifications(list);

        // mark all notifications as read
        await api.put("/Notifications/read-all");

        // refresh list so UI updates unread dot/badge if backend changes IsRead
        const res2 = await api.get("/Notifications");
        if (res2.success) setNotifications(res2.data || []);
      }
    } catch (err) {
      console.log("Notification error:", err?.response?.data || err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, []),
  );

  if (notifications.length === 0) {
    return (
      <EmptyState
        iconName="notifications-outline"
        title="No notifications"
        subtitle="You're all caught up!"
      />
    );
  }

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={{ paddingVertical: 8 }}
      renderItem={({ item }) => {
        const cardOpacity = unread ? 1 : 0.75;
        const pill = getTypePill(item.type);
        const unread = item.isRead === false || item.IsRead === false; // handle both cases

        return (
          <View
            style={[styles.card, { backgroundColor: getNotifBg(item.type), opacity: cardOpacity }]}
          >
            <View style={styles.rowTop}>
              <View style={styles.leftTop}>
                {unread && <View style={styles.unreadDot} />}

                <Ionicons
                  name={getTypeIcon(item.type)}
                  size={18}
                  color={getTypeIconColor(item.type)}
                  style={{ marginRight: 8 }}
                />

                <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                  <Text style={styles.pillText}>{pill.text}</Text>
                </View>
              </View>

              <Text style={styles.timeText}>
                {timeAgo(item.createdAt || item.CreatedAt)}
              </Text>
            </View>

            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.message} numberOfLines={3}>
              {item.message}
            </Text>
          </View>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 14,
    borderRadius: 14,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  leftTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
    marginRight: 8,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  pillText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  timeText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: "#333",
    lineHeight: 18,
  },
});

export default NotificationsScreen;
