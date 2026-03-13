import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAuth } from "../context/AuthContext";
import api from "../services/api/axiosInstance";
import { RefreshControl } from "react-native";
import {
  roleToString,
  requestStatusToString,
  leaveTypeToInt,
  leaveTypeToString,
} from "../utils/helpers";
import { useTheme } from "../context/ThemeContext";

export default function LeaveRequestScreen() {
  const { colors, darkMode } = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const role = roleToString(user?.role);
  const isManager = role === "Manager" || role === "Admin";

  const [requests, setRequests] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [type, setType] = useState("Vacation");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [reason, setReason] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    if (user) loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const formatDate = (date) => {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadRequests();
    } finally {
      setRefreshing(false);
    }
  };

  const loadRequests = async () => {
    try {
      const res =
        role === "Employee"
          ? await api.get("/LeaveRequests/my")
          : await api.get("/LeaveRequests/pending");

      if (res?.success) setRequests(res.data || []);
      else Alert.alert("Error", res?.message || "Failed to load requests");
    } catch (error) {
      console.log("LOAD LEAVES status:", error.response?.status);
      console.log("LOAD LEAVES body:", error.response?.data);
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to load requests",
      );
    }
  };

  const handleCreate = async () => {
    if (!startDate || !endDate || !reason) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (endDate < startDate) {
      Alert.alert("Error", "End date must be after start date");
      return;
    }

    try {
      const res = await api.post("/LeaveRequests", {
        type: leaveTypeToInt(type),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason,
      });

      if (res?.success) {
        Alert.alert("Success", "Leave request created");
        setModalVisible(false);
        setReason("");
        setStartDate(null);
        setEndDate(null);
        await loadRequests();
      } else {
        Alert.alert("Error", res?.message || "Failed to create request");
      }
    } catch (error) {
      console.log("CREATE LEAVE status:", error.response?.status);
      console.log("CREATE LEAVE body:", error.response?.data);
      Alert.alert(
        "Error",
        error.response?.data?.message ||
          error.message ||
          "Failed to create request",
      );
    }
  };

  const handleReview = async (status) => {
    if (!selectedRequest?.id) {
      Alert.alert("Error", "No request selected");
      return;
    }

    try {
      const res = await api.put(`/Approvals/leave/${selectedRequest.id}`, {
        status,
        managerComment: reviewComment,
      });

      if (res?.success) {
        Alert.alert("Success", `Request ${String(status).toLowerCase()}`);
        setReviewModalVisible(false);
        setReviewComment("");
        setSelectedRequest(null);
        await loadRequests();
      } else {
        Alert.alert("Error", res?.message || "Failed to review request");
      }
    } catch (error) {
      console.log("REVIEW LEAVE status:", error.response?.status);
      console.log("REVIEW LEAVE body:", error.response?.data);
      Alert.alert(
        "Error",
        error.response?.data?.message ||
          error.message ||
          "Failed to review request",
      );
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Approved":
        return colors.success;
      case "Rejected":
        return colors.error;
      default:
        return "#FF9800";
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 15,
    },
    createButton: {
      backgroundColor: colors.primary,
      padding: 15,
      borderRadius: 10,
      alignItems: "center",
      marginBottom: 20,
    },
    createButtonText: {
      color: colors.textOnPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    requestItem: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 15,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: colors.border,
    },
    requestType: {
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 5,
      color: colors.textPrimary,
    },
    requestDates: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 5,
    },
    requestReason: {
      fontSize: 14,
      marginBottom: 10,
      color: colors.textPrimary,
    },
    requestStatus: {
      fontSize: 14,
      fontWeight: "600",
    },
    reviewButtons: {
      flexDirection: "row",
      marginTop: 10,
    },
    reviewButton: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
      alignItems: "center",
      marginHorizontal: 5,
    },
    approveButton: {
      backgroundColor: colors.success,
    },
    rejectButton: {
      backgroundColor: colors.error,
    },
    reviewButtonText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.45)",
      padding: 16,
    },
    modalCard: {
      width: "92%",
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 20,
      color: colors.textPrimary,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: 6,
    },
    pickerWrapper: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 10,
      backgroundColor: colors.surface,
    },
    dateRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    dateField: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
    },
    dateText: {
      fontSize: 15,
      color: colors.textPrimary,
    },
    placeholderText: {
      color: colors.textTertiary,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 15,
      marginBottom: 15,
      fontSize: 16,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
    },
    textArea: {
      minHeight: 90,
      textAlignVertical: "top",
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    button: {
      flex: 1,
      padding: 15,
      borderRadius: 10,
      alignItems: "center",
      marginHorizontal: 5,
    },
    cancelBtn: {
      backgroundColor: darkMode ? colors.background : "#F2F2F2",
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
    },
    cancelBtnText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    primaryBtnText: {
      color: colors.textOnPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
  });

  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <Text style={{ color: colors.textPrimary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {!isManager && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>+ Create Leave Request</Text>
        </TouchableOpacity>
      )}

      {requests.map((request) => {
        const statusLabel = requestStatusToString(request.status);
        const typeLabel = leaveTypeToString(request.type);

        return (
          <View key={request.id} style={styles.requestItem}>
            <Text style={styles.requestType}>{typeLabel}</Text>

            <Text style={styles.requestDates}>
              {new Date(request.startDate).toLocaleDateString()} -{" "}
              {new Date(request.endDate).toLocaleDateString()}
            </Text>

            <Text style={styles.requestReason}>{request.reason}</Text>

            <Text
              style={[
                styles.requestStatus,
                { color: getStatusColor(statusLabel) },
              ]}
            >
              {statusLabel}
            </Text>

            {isManager && statusLabel === "Pending" && (
              <View style={styles.reviewButtons}>
                <TouchableOpacity
                  style={[styles.reviewButton, styles.approveButton]}
                  onPress={() => {
                    setSelectedRequest(request);
                    setReviewModalVisible(true);
                  }}
                >
                  <Text style={styles.reviewButtonText}>Review</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Leave Request</Text>

            <Text style={styles.label}>Leave type</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={type}
                onValueChange={setType}
                dropdownIconColor={colors.textPrimary}
                style={{ color: colors.textPrimary }}
              >
                <Picker.Item label="Vacation" value="Vacation" />
                <Picker.Item label="Sick" value="Sick" />
                <Picker.Item label="Personal" value="Personal" />
              </Picker>
            </View>

            <Text style={styles.label}>Dates</Text>

            <View style={styles.dateRow}>
              <Pressable
                style={styles.dateField}
                onPress={() => setShowStartPicker(true)}
              >
                <Text
                  style={[
                    styles.dateText,
                    !startDate && styles.placeholderText,
                  ]}
                >
                  {startDate ? formatDate(startDate) : "Start date"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.dateField}
                onPress={() => setShowEndPicker(true)}
              >
                <Text
                  style={[styles.dateText, !endDate && styles.placeholderText]}
                >
                  {endDate ? formatDate(endDate) : "End date"}
                </Text>
              </Pressable>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startDate || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, date) => {
                  setShowStartPicker(false);
                  if (event.type === "dismissed") return;
                  setStartDate(date);
                  if (endDate && date && endDate < date) setEndDate(date);
                }}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endDate || startDate || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={startDate || undefined}
                onChange={(event, date) => {
                  setShowEndPicker(false);
                  if (event.type === "dismissed") return;
                  setEndDate(date);
                }}
              />
            )}

            <Text style={styles.label}>Reason</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write a short reason..."
              placeholderTextColor={colors.textTertiary}
              value={reason}
              onChangeText={setReason}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelBtn]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.primaryBtn]}
                onPress={handleCreate}
              >
                <Text style={styles.primaryBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reviewModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Review Leave Request</Text>

            <Text style={styles.label}>Manager comment (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write a short comment..."
              placeholderTextColor={colors.textTertiary}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelBtn]}
                onPress={() => {
                  setReviewModalVisible(false);
                  setReviewComment("");
                  setSelectedRequest(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.rejectButton]}
                onPress={() => handleReview("Rejected")}
              >
                <Text style={styles.reviewButtonText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.approveButton]}
                onPress={() => handleReview("Approved")}
              >
                <Text style={styles.reviewButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
