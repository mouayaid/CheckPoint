import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../services/api/axiosInstance";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

const ManagerApprovalsScreen = () => {
  const { colors } = useTheme();
  const { user } = useAuth();

  const isAdmin = user?.role === "Admin" || user?.role === 3;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState(null);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const normalizeDate = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString();
  };

  const normalizeDateTime = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case "leave":
        return {
          bg: "#E8F1FF",
          text: "#2F6FED",
          icon: "calendar-outline",
          label: "Leave",
        };
      case "room":
        return {
          bg: "#EAFBF1",
          text: "#1E9E5A",
          icon: "business-outline",
          label: "Room",
        };
      case "user":
        return {
          bg: "#F4ECFF",
          text: "#7A3AED",
          icon: "person-outline",
          label: "Account",
        };
      default:
        return {
          bg: colors.surfaceVariant || "#EEE",
          text: colors.text,
          icon: "information-circle-outline",
          label: "Request",
        };
    }
  };

  const mapLeaveItem = (item) => ({
    key: `leave-${item.id}`,
    id: item.id,
    type: "leave",
    title: "Leave Request",
    requester: item.userName || `User #${item.userId}`,
    details: `${normalizeDate(item.startDate)} → ${normalizeDate(item.endDate)}`,
    extra: item.reason || item.type || "Leave request",
    status: item.status || "Pending",
    createdAt: item.createdAt,
  });

  const mapRoomItem = (item) => ({
    key: `room-${item.id}`,
    id: item.id,
    type: "room",
    title: "Room Reservation",
    requester: item.userName || `User #${item.userId}`,
    details: `${item.roomName || "Room"} • ${normalizeDate(item.reservationDate)}`,
    extra: `${item.startTime || ""} ${item.endTime ? `- ${item.endTime}` : ""}`.trim(),
    status: item.status || "Pending",
    createdAt: item.createdAt,
  });

  const mapUserItem = (item) => ({
    key: `user-${item.id}`,
    id: item.id,
    type: "user",
    title: "Account Approval",
    requester: item.fullName || "Unknown user",
    details: item.email || "No email",
    extra: item.departmentName || "No department",
    status: "Pending",
    createdAt: item.createdAt,
  });

  const fetchApprovals = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const requests = [
        api.get("/Leave/pending-review"),
        api.get("/api/RoomReservation/pending"),
      ];

      if (isAdmin) {
        requests.push(api.get("/api/admin/users/pending"));
      }

      const results = await Promise.allSettled(requests);

      let leaveItems = [];
      let roomItems = [];
      let userItems = [];

      if (results[0].status === "fulfilled") {
        const payload = results[0].value;
        const data = Array.isArray(payload)
          ? payload
          : payload?.data || payload?.data?.data || [];
        leaveItems = data.map(mapLeaveItem);
      }

      if (results[1].status === "fulfilled") {
        const payload = results[1].value;
        const data = Array.isArray(payload)
          ? payload
          : payload?.data || payload?.data?.data || [];
        roomItems = data.map(mapRoomItem);
      }

      if (isAdmin && results[2]?.status === "fulfilled") {
        const payload = results[2].value;
        const data = Array.isArray(payload)
          ? payload
          : payload?.data || payload?.data?.data || [];
        userItems = data.map(mapUserItem);
      }

      const merged = [...userItems, ...leaveItems, ...roomItems].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );

      setItems(merged);
    } catch (error) {
      Alert.alert("Error", "Failed to load approvals.");
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchApprovals();
    }, [])
  );

  const handleApprove = async (item) => {
    try {
      setActionLoadingKey(item.key);

      if (item.type === "leave") {
        await api.put(`/Leave/requests/${item.id}/approve`, {
          comment: "Approved by manager",
        });
      } else if (item.type === "room") {
        await api.put(`/api/RoomReservation/${item.id}/approve`);
      } else if (item.type === "user") {
        await api.put(`/api/admin/users/${item.id}/approve`, {
          leaveBalance: 18,
        });
      }

      await fetchApprovals();
    } catch (error) {
      Alert.alert("Error", "Failed to approve.");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleReject = async (item) => {
    try {
      setActionLoadingKey(item.key);

      if (item.type === "leave") {
        await api.put(`/Leave/requests/${item.id}/reject`, {
          comment: "Rejected by manager",
        });
      } else if (item.type === "room") {
        await api.put(`/api/RoomReservation/${item.id}/reject`);
      } else if (item.type === "user") {
        Alert.alert("Not available", "User rejection is not implemented yet.");
        return;
      }

      await fetchApprovals();
    } catch (error) {
      Alert.alert("Error", "Failed to reject.");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const renderItem = ({ item }) => {
    const isBusy = actionLoadingKey === item.key;
    const badge = getBadgeStyle(item.type);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={14} color={badge.text} />
            <Text style={[styles.badgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>

          <Text style={styles.createdAt}>
            {normalizeDateTime(item.createdAt)}
          </Text>
        </View>

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.requester}>{item.requester}</Text>
        <Text style={styles.details}>{item.details}</Text>
        <Text style={styles.extra}>{item.extra}</Text>

        <View style={styles.statusRow}>
          <Ionicons name="time-outline" size={14} color={colors.warning || "#D97706"} />
          <Text style={styles.statusText}>{item.status}</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton, isBusy && styles.disabledButton]}
            onPress={() => handleReject(item)}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="close-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton, isBusy && styles.disabledButton]}
            onPress={() => handleApprove(item)}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading approvals...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconWrap}>
          <Ionicons
            name="checkmark-done-circle-outline"
            size={58}
            color={colors.primary}
          />
        </View>
        <Text style={styles.emptyTitle}>No pending approvals</Text>
        <Text style={styles.emptySubtitle}>
          Everything has already been reviewed.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchApprovals(true)}
          tintColor={colors.primary}
        />
      }
    />
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    listContent: {
      padding: 14,
      paddingBottom: 28,
      backgroundColor: colors.background,
    },

    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
      paddingHorizontal: 24,
    },

    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: colors.textSecondary,
    },

    emptyIconWrap: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      marginBottom: 14,
    },

    emptyTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
    },

    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border || "#E5E7EB",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      gap: 10,
    },

    badge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      gap: 6,
    },

    badgeText: {
      fontSize: 12,
      fontWeight: "700",
    },

    createdAt: {
      fontSize: 12,
      color: colors.textSecondary,
    },

    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
    },

    requester: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 6,
    },

    details: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 4,
    },

    extra: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },

    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 14,
    },

    statusText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },

    actionsRow: {
      flexDirection: "row",
      gap: 10,
    },

    actionButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },

    approveButton: {
      backgroundColor: colors.primary,
    },

    rejectButton: {
      backgroundColor: "#E5484D",
    },

    disabledButton: {
      opacity: 0.7,
    },

    actionButtonText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
    },
  });

export default ManagerApprovalsScreen;