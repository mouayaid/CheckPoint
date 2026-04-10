import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api/axiosInstance";
import { useTheme } from "../context/ThemeContext";

export default function PendingLeaveRequestsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const [processingId, setProcessingId] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);

  const fetchRequests = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await api.get("/Leave/requests/pending");
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setRequests(data);
    } catch (err) {
      console.log("Fetch pending leave requests error:", {
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data,
        url: err?.config?.url,
        baseURL: err?.config?.baseURL,
      });

      Alert.alert(
        "Error",
        err?.response?.data?.message ||
          `Failed to load pending leave requests${
            err?.response?.status ? ` (status ${err.response.status})` : ""
          }.`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (item) => {
    try {
      setProcessingId(item.id);
      setProcessingAction("approve");

      await api.put(`/Leave/requests/${item.id}/review`, {
        status: "Approved",
        managerComment: "Approved by manager",
      });

      setRequests((prev) => prev.filter((req) => req.id !== item.id));
      Alert.alert("Success", "Leave request approved.");
    } catch (err) {
      console.log("Approve leave error:", {
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data,
        url: err?.config?.url,
        baseURL: err?.config?.baseURL,
      });

      const message =
        err?.response?.data?.message || "Failed to approve leave request.";
      Alert.alert("Error", message);
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const openRejectModal = (item) => {
    setSelectedRequest(item);
    setRejectComment("");
    setRejectModalVisible(true);
  };

  const closeRejectModal = () => {
    setRejectModalVisible(false);
    setSelectedRequest(null);
    setRejectComment("");
  };

  const submitReject = async () => {
    if (!selectedRequest) return;

    const comment = rejectComment.trim();
    if (!comment) {
      Alert.alert("Validation", "Rejection comment is required.");
      return;
    }

    try {
      setProcessingId(selectedRequest.id);
      setProcessingAction("reject");

      await api.put(`/Leave/requests/${selectedRequest.id}/review`, {
        status: "Rejected",
        managerComment: comment,
      });

      setRequests((prev) =>
        prev.filter((req) => req.id !== selectedRequest.id)
      );

      closeRejectModal();
      Alert.alert("Success", "Leave request rejected.");
    } catch (err) {
      console.log("Reject leave error:", {
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data,
        url: err?.config?.url,
        baseURL: err?.config?.baseURL,
      });

      const message =
        err?.response?.data?.message || "Failed to reject leave request.";
      Alert.alert("Error", message);
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).split("T")[0];
    return date.toLocaleDateString();
  };

  const renderItem = ({ item }) => {
    const isProcessingThis =
      processingId === item.id && processingAction !== null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.nameBlock}>
            <Ionicons
              name="person-circle-outline"
              size={22}
              color={colors.primary}
            />
            <Text style={styles.name}>{item.userName || "Unknown user"}</Text>
          </View>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {item.typeLabel || item.type || "Leave"}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={styles.infoText}>
            {formatDate(item.startDate)} → {formatDate(item.endDate)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons
            name="document-text-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={styles.infoText}>
            {item.reason || "No reason provided"}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons
            name="time-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={styles.infoText}>
            Created: {formatDate(item.createdAt)}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.approveButton,
              isProcessingThis && styles.disabledButton,
            ]}
            onPress={() => handleApprove(item)}
            disabled={isProcessingThis}
          >
            {isProcessingThis && processingAction === "approve" ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.actionText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.rejectButton,
              isProcessingThis && styles.disabledButton,
            ]}
            onPress={() => openRejectModal(item)}
            disabled={isProcessingThis}
          >
            {isProcessingThis && processingAction === "reject" ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="close" size={16} color="#fff" />
                <Text style={styles.actionText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.helperText}>Loading pending requests...</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        contentContainerStyle={
          requests.length === 0
            ? styles.emptyListContainer
            : styles.listContainer
        }
        data={requests}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchRequests(true)}
          />
        }
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={54}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyTitle}>No pending requests</Text>
            <Text style={styles.helperText}>
              Everything is reviewed for now.
            </Text>
          </View>
        }
      />

      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRejectModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Leave Request</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a reason for rejection.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Write your comment..."
              placeholderTextColor={colors.textSecondary}
              multiline
              value={rejectComment}
              onChangeText={setRejectComment}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeRejectModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmRejectButton]}
                onPress={submitReject}
              >
                <Text style={styles.confirmRejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    listContainer: {
      padding: 12,
      backgroundColor: colors.background,
    },
    emptyListContainer: {
      flexGrow: 1,
      backgroundColor: colors.background,
    },
    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: colors.background,
    },
    helperText: {
      marginTop: 8,
      color: colors.textSecondary,
      textAlign: "center",
    },
    emptyTitle: {
      marginTop: 12,
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      gap: 12,
    },
    nameBlock: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    name: {
      marginLeft: 8,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      flexShrink: 1,
    },
    badge: {
      backgroundColor: colors.background,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "600",
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 8,
      gap: 8,
    },
    infoText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },
    actionButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },
    approveButton: {
      backgroundColor: "#16a34a",
    },
    rejectButton: {
      backgroundColor: "#dc2626",
    },
    disabledButton: {
      opacity: 0.7,
    },
    actionText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      padding: 20,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    modalSubtitle: {
      color: colors.textSecondary,
      marginBottom: 14,
      lineHeight: 20,
    },
    input: {
      minHeight: 110,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      color: colors.textPrimary,
      textAlignVertical: "top",
      backgroundColor: colors.background,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 16,
      gap: 10,
    },
    modalButton: {
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    cancelButton: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      color: colors.textPrimary,
      fontWeight: "600",
    },
    confirmRejectButton: {
      backgroundColor: "#dc2626",
    },
    confirmRejectText: {
      color: "#fff",
      fontWeight: "700",
    },
  });