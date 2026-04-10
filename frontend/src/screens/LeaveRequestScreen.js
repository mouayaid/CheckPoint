import React, { useEffect, useMemo, useState } from "react";
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
  RefreshControl,
  LayoutAnimation,
  UIManager,
} from "react-native";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { leaveService, profileService } from "../services/api";
import {
  roleToString,
  requestStatusToString,
  leaveTypeToInt,
  leaveTypeToString,
} from "../utils/helpers";
import { useTheme } from "../context/ThemeContext";

const LEAVE_TYPES = ["Vacation", "Sick", "Personal"];
const FILTERS_EMPLOYEE = ["All", "Pending", "Approved", "Rejected"];

const formatDateValue = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDateReadable = (dateString) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString();
};

const getDayCount = (start, end) => {
  if (!start || !end) return null;
  const startTs = new Date(start).setHours(0, 0, 0, 0);
  const endTs = new Date(end).setHours(0, 0, 0, 0);
  const diffTime = endTs - startTs;
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return days > 0 ? days : 1;
};

const normalizeStatus = (status) =>
  String(status || "")
    .trim()
    .toLowerCase();

const normalizeDateOnly = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function LeaveRequestScreen() {
  const { colors, darkMode, spacing, borderRadius, typography, shadows } =
    useTheme();

  const styles = useMemo(
    () =>
      createStyles(
        colors,
        darkMode,
        spacing,
        borderRadius,
        typography,
        shadows,
      ),
    [colors, darkMode, spacing, borderRadius, typography, shadows],
  );

  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const openCreateModal = route?.params?.openCreateModal === true;

  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [type, setType] = useState("Vacation");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [reason, setReason] = useState("");
  const [creating, setCreating] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewingAction, setReviewingAction] = useState("");

  const [activeFilter, setActiveFilter] = useState("All");

  const role = roleToString(user?.role);
  const isManager = role === "Manager" || role === "Admin";

  useEffect(() => {
    if (user) {
      loadRequests();
      loadLeaveBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!loadingBalance && openCreateModal) {
      if (leaveBalance > 0) {
        setModalVisible(true);
      }

      navigation.setParams({ openCreateModal: false });
    }
  }, [openCreateModal, loadingBalance, leaveBalance, navigation]);

  const resetCreateModal = () => {
    setModalVisible(false);
    setType("Vacation");
    setStartDate(null);
    setEndDate(null);
    setReason("");
    setShowStartPicker(false);
    setShowEndPicker(false);
    setCreating(false);
  };

  const resetReviewModal = () => {
    setReviewModalVisible(false);
    setReviewComment("");
    setSelectedRequest(null);
    setReviewingAction("");
  };

  const loadLeaveBalance = async () => {
    setLoadingBalance(true);
    try {
      const res = await profileService.getProfile();

      const payload = res?.data?.data || res?.data || null;

      const userProfile =
        payload?.user ??
        payload?.User ??
        payload?.userDto ??
        payload?.UserDto ??
        payload ??
        null;

      const rawBalance =
        userProfile?.leaveBalance ??
        userProfile?.LeaveBalance ??
        payload?.leaveBalance ??
        payload?.LeaveBalance ??
        0;

      const balance = Number(rawBalance);
      setLeaveBalance(Number.isNaN(balance) ? 0 : balance);
    } catch (error) {
      console.log("LOAD BALANCE status:", error?.status);
      console.log("LOAD BALANCE body:", error?.data);
      console.log("LOAD BALANCE message:", error?.message);
      setLeaveBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadRequests(), loadLeaveBalance()]);
    } finally {
      setRefreshing(false);
    }
  };

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await leaveService.getMyLeaveRequests();

      if (res?.success) {
        const normalized = (res.data || []).map((request) => ({
          ...request,
          normalizedStatus: normalizeStatus(
            requestStatusToString(request.status),
          ),
          statusLabel: requestStatusToString(request.status),
          typeLabel: leaveTypeToString(request.type),
        }));

        setRequests(normalized);
      } else {
        Alert.alert("Error", res?.message || "Failed to load requests");
      }
    } catch (error) {
      console.log("LOAD LEAVES status:", error?.status);
      console.log("LOAD LEAVES body:", error?.data);
      console.log("LOAD LEAVES message:", error?.message);
      Alert.alert("Error", error?.message || "Failed to load requests");
    } finally {
      setLoadingRequests(false);
    }
  };

  const requestedDays = getDayCount(startDate, endDate);
  const trimmedReason = reason.trim();

  const formValidationMessage = useMemo(() => {
    if (!startDate || !endDate || !trimmedReason) {
      return "Please fill in all fields";
    }

    if (trimmedReason.length < 5) {
      return "Reason must be at least 5 characters";
    }

    if (trimmedReason.length > 300) {
      return "Reason must be less than 300 characters";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normalizedStart = normalizeDateOnly(startDate);
    const normalizedEnd = normalizeDateOnly(endDate);

    if (normalizedStart < today) {
      return "Start date cannot be in the past";
    }

    if (normalizedEnd < normalizedStart) {
      return "End date must be after start date";
    }

    if (
      leaveBalance !== null &&
      requestedDays !== null &&
      requestedDays > leaveBalance
    ) {
      return `You only have ${leaveBalance} leave day${
        leaveBalance === 1 ? "" : "s"
      } left`;
    }

    const hasOverlap = requests.some((request) => {
      const status = normalizeStatus(request.statusLabel);
      if (status === "rejected" || status === "cancelled") return false;

      const requestStart = normalizeDateOnly(request.startDate);
      const requestEnd = normalizeDateOnly(request.endDate);

      return normalizedStart <= requestEnd && normalizedEnd >= requestStart;
    });

    if (hasOverlap) {
      return "You already have a leave request overlapping these dates";
    }

    return null;
  }, [startDate, endDate, trimmedReason, leaveBalance, requestedDays, requests]);

  const validateLeaveRequest = () => {
    return formValidationMessage;
  };

  const isCreateDisabled =
    creating ||
    loadingBalance ||
    leaveBalance === null ||
    leaveBalance <= 0 ||
    !!formValidationMessage;

  const handleCreate = async () => {
    const validationError = validateLeaveRequest();

    if (validationError) {
      Alert.alert("Error", validationError);
      return;
    }

    setCreating(true);

    try {
      const res = await leaveService.createLeaveRequest({
        type: leaveTypeToInt(type),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: trimmedReason,
      });

      if (res?.success) {
        Alert.alert("Success", "Leave request created");
        resetCreateModal();
        await Promise.all([loadRequests(), loadLeaveBalance()]);
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
    } finally {
      setCreating(false);
    }
  };

  const handleReview = async (status) => {
    if (!selectedRequest?.id) {
      Alert.alert("Error", "No request selected");
      return;
    }

    const decision =
      String(status).toLowerCase() === "approved" ? "approve" : "reject";

    setReviewingAction(status);

    try {
      const res = await leaveService.review(selectedRequest.id, {
        decision,
        comment: reviewComment.trim(),
      });

      const success = res?.success;

      if (success) {
        Alert.alert("Success", `Request ${String(status).toLowerCase()}`);
        resetReviewModal();
        await loadRequests();
      } else {
        Alert.alert(
          "Error",
          res?.data?.message || res?.message || "Failed to review request",
        );
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
    } finally {
      setReviewingAction("");
    }
  };

  const getStatusStyles = (status) => {
    const normalized = normalizeStatus(status);

    if (normalized === "approved") {
      return {
        badge: styles.statusApproved,
        text: styles.statusApprovedText,
        border: styles.requestApprovedBorder,
        label: "Approved",
      };
    }

    if (normalized === "rejected") {
      return {
        badge: styles.statusRejected,
        text: styles.statusRejectedText,
        border: styles.requestRejectedBorder,
        label: "Rejected",
      };
    }

    if (normalized === "pending") {
      return {
        badge: styles.statusPending,
        text: styles.statusPendingText,
        border: styles.requestPendingBorder,
        label: "Pending",
      };
    }

    if (normalized === "cancelled") {
      return {
        badge: styles.statusCancelled,
        text: styles.statusCancelledText,
        border: styles.requestDefaultBorder,
        label: "Cancelled",
      };
    }

    return {
      badge: styles.statusDefault,
      text: styles.statusDefaultText,
      border: styles.requestDefaultBorder,
      label: status || "Unknown",
    };
  };

  const filteredRequests = useMemo(() => {
    if (activeFilter === "All") return requests;
    return requests.filter(
      (request) => request.normalizedStatus === normalizeStatus(activeFilter),
    );
  }, [requests, activeFilter]);

  const filterCounts = useMemo(() => {
    return {
      All: requests.length,
      Pending: requests.filter((r) => r.normalizedStatus === "pending").length,
      Approved: requests.filter((r) => r.normalizedStatus === "approved")
        .length,
      Rejected: requests.filter((r) => r.normalizedStatus === "rejected")
        .length,
    };
  }, [requests]);

  const filterOptions = FILTERS_EMPLOYEE;

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.stickyHeader}>
        <Text style={styles.screenTitle}>Leave Requests</Text>
        <Text style={styles.screenSubtitle}>
          Create and track your leave requests
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <>
          <TouchableOpacity
            style={[
              styles.createButton,
              !loadingBalance && leaveBalance <= 0 && styles.createButtonDisabled,
            ]}
            activeOpacity={0.9}
            onPress={() => {
              if (loadingBalance) return;

              if (leaveBalance > 0) {
                setModalVisible(true);
                return;
              }

              Alert.alert(
                "No leave balance",
                "You have no leave days left. You can still review your previous requests below.",
              );
            }}
          >
            <Text
              style={[
                styles.createButtonText,
                !loadingBalance &&
                  leaveBalance <= 0 &&
                  styles.createButtonTextDisabled,
              ]}
            >
              {loadingBalance
                ? "Checking balance..."
                : leaveBalance > 0
                  ? "+ Create Leave Request"
                  : "View Previous Requests"}
            </Text>
          </TouchableOpacity>

          {!loadingBalance && leaveBalance <= 0 && (
            <View style={styles.balanceWarningCard}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={colors.warning}
              />
              <Text style={styles.balanceWarningText}>
                Your leave balance is 0. You cannot create a new leave request.
              </Text>
            </View>
          )}
        </>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filterOptions.map((filter) => {
            const selected = activeFilter === filter;
            const count = filterCounts[filter] ?? 0;

            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, selected && styles.filterChipActive]}
                activeOpacity={0.85}
                onPress={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setActiveFilter(filter);
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selected && styles.filterChipTextActive,
                  ]}
                >
                  {filter} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loadingRequests ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Loading requests...</Text>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {isManager
                ? activeFilter === "Pending"
                  ? "No pending requests"
                  : "No matching requests"
                : "No leave requests found"}
            </Text>
            <Text style={styles.emptyText}>
              {isManager
                ? "There are currently no requests for this filter."
                : "Try another filter or create your first leave request."}
            </Text>
          </View>
        ) : (
          filteredRequests.map((request) => {
            const statusStyle = getStatusStyles(request.statusLabel);
            const dayCount = getDayCount(request.startDate, request.endDate);

            return (
              <View
                key={request.id}
                style={[styles.requestItem, statusStyle.border]}
              >
                <View style={styles.requestHeader}>
                  <View style={styles.requestTitleWrap}>
                    {isManager && !!request.employeeName && (
                      <Text style={styles.employeeName}>
                        {request.employeeName}
                      </Text>
                    )}

                    <Text style={styles.requestType}>{request.typeLabel}</Text>

                    <Text style={styles.requestDates}>
                      {formatDateReadable(request.startDate)} -{" "}
                      {formatDateReadable(request.endDate)}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, statusStyle.badge]}>
                    <Text style={[styles.statusText, statusStyle.text]}>
                      {statusStyle.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillLabel}>Duration</Text>
                    <Text style={styles.metaPillText}>
                      {dayCount} {dayCount === 1 ? "day" : "days"}
                    </Text>
                  </View>

                  {!!request.createdAt && (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Submitted</Text>
                      <Text style={styles.metaPillText}>
                        {formatDateReadable(request.createdAt)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Reason</Text>
                  <Text style={styles.requestReason}>{request.reason}</Text>
                </View>

                {!!request.managerComment && (
                  <View style={styles.commentBox}>
                    <Text style={styles.commentLabel}>Manager comment</Text>
                    <Text style={styles.commentText}>
                      {request.managerComment}
                    </Text>
                  </View>
                )}

                {null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={resetCreateModal}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={resetCreateModal} />
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.modalTitle}>Create Leave Request</Text>
              <Text style={styles.modalSubtitle}>
                Fill in the details of your request
              </Text>

              <View style={styles.section}>
                <Text style={styles.label}>Leave type</Text>

                <View style={styles.typeChipRow}>
                  {LEAVE_TYPES.map((item) => {
                    const selected = type === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.typeChip,
                          selected && styles.typeChipActive,
                        ]}
                        activeOpacity={0.85}
                        onPress={() => setType(item)}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            selected && styles.typeChipTextActive,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Dates</Text>

                <View style={styles.dateRow}>
                  <Pressable
                    style={styles.dateField}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <View style={styles.dateIconRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.dateText,
                          !startDate && styles.placeholderText,
                        ]}
                      >
                        {startDate ? formatDateValue(startDate) : "Start date"}
                      </Text>
                    </View>
                    <Text style={styles.dateFieldLabel}>Start</Text>
                  </Pressable>

                  <Pressable
                    style={styles.dateField}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <View style={styles.dateIconRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.dateText,
                          !endDate && styles.placeholderText,
                        ]}
                      >
                        {endDate ? formatDateValue(endDate) : "End date"}
                      </Text>
                    </View>
                    <Text style={styles.dateFieldLabel}>End</Text>
                  </Pressable>
                </View>

                {startDate && endDate && (
                  <View style={styles.helperCard}>
                    <Text style={styles.helperLabel}>Duration</Text>
                    <Text style={styles.helperText}>
                      {requestedDays} {requestedDays === 1 ? "day" : "days"}
                    </Text>
                  </View>
                )}

                {showStartPicker && (
                  <DateTimePicker
                    value={startDate || new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    minimumDate={new Date()}
                    onChange={(event, date) => {
                      setShowStartPicker(false);
                      if (event.type === "dismissed") return;
                      setStartDate(date);
                      if (endDate && date && endDate < date) {
                        setEndDate(date);
                      }
                    }}
                  />
                )}

                {showEndPicker && (
                  <DateTimePicker
                    value={endDate || startDate || new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    minimumDate={startDate || new Date()}
                    onChange={(event, date) => {
                      setShowEndPicker(false);
                      if (event.type === "dismissed") return;
                      setEndDate(date);
                    }}
                  />
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Reason</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Write a short reason..."
                  placeholderTextColor={colors.textTertiary}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  maxLength={300}
                />
                <Text style={styles.fieldHelperText}>
                  Please add a clear short explanation ({trimmedReason.length}/300).
                </Text>
              </View>

              {!!formValidationMessage &&
                !(
                  formValidationMessage === "Please fill in all fields" &&
                  !startDate &&
                  !endDate &&
                  !trimmedReason
                ) && (
                  <View style={styles.validationCard}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={colors.warning}
                    />
                    <Text style={styles.validationText}>
                      {formValidationMessage}
                    </Text>
                  </View>
                )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelBtn]}
                  activeOpacity={0.85}
                  onPress={resetCreateModal}
                  disabled={creating}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryBtn,
                    isCreateDisabled && styles.primaryBtnDisabled,
                  ]}
                  activeOpacity={isCreateDisabled ? 1 : 0.9}
                  onPress={handleCreate}
                  disabled={isCreateDisabled}
                >
                  <Text
                    style={[
                      styles.primaryBtnText,
                      isCreateDisabled && styles.primaryBtnTextDisabled,
                    ]}
                  >
                    {creating ? "Creating..." : "Create"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        transparent
        onRequestClose={resetReviewModal}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={resetReviewModal} />
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.modalTitle}>Review Leave Request</Text>
              <Text style={styles.modalSubtitle}>
                Add an optional comment and choose an action
              </Text>

              {selectedRequest && (
                <View style={styles.reviewSummaryCard}>
                  {!!selectedRequest.employeeName && (
                    <Text style={styles.reviewSummaryEmployee}>
                      {selectedRequest.employeeName}
                    </Text>
                  )}

                  <Text style={styles.reviewSummaryType}>
                    {leaveTypeToString(selectedRequest.type)}
                  </Text>

                  <Text style={styles.reviewSummaryDates}>
                    {formatDateReadable(selectedRequest.startDate)} -{" "}
                    {formatDateReadable(selectedRequest.endDate)}
                  </Text>

                  {!!selectedRequest.reason && (
                    <Text style={styles.reviewSummaryReason}>
                      {selectedRequest.reason}
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.label}>Manager comment (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Write a short comment..."
                  placeholderTextColor={colors.textTertiary}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  multiline
                />
              </View>

              <View style={styles.reviewActionRow}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelBtn,
                    styles.reviewThirdButton,
                  ]}
                  activeOpacity={0.85}
                  onPress={resetReviewModal}
                  disabled={!!reviewingAction}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.rejectButton,
                    styles.reviewThirdButton,
                  ]}
                  activeOpacity={0.9}
                  onPress={() => handleReview("Rejected")}
                  disabled={!!reviewingAction}
                >
                  <Text style={styles.reviewButtonText}>
                    {reviewingAction === "Rejected" ? "Rejecting..." : "Reject"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.approveButton,
                    styles.reviewThirdButton,
                  ]}
                  activeOpacity={0.9}
                  onPress={() => handleReview("Approved")}
                  disabled={!!reviewingAction}
                >
                  <Text style={styles.reviewButtonText}>
                    {reviewingAction === "Approved"
                      ? "Approving..."
                      : "Approve"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (
  colors,
  darkMode,
  spacing,
  borderRadius,
  typography,
  shadows,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    createButtonDisabled: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: { shadowOpacity: 0 },
        android: { elevation: 0 },
      }),
    },

    createButtonTextDisabled: {
      color: colors.textMuted,
    },

    balanceWarningCard: {
      marginTop: -spacing.sm,
      marginBottom: spacing.lg,
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    balanceWarningText: {
      flex: 1,
      fontSize: typography.sm,
      color: colors.warning,
      fontWeight: typography.semibold,
      lineHeight: 20,
    },

    validationCard: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    validationText: {
      flex: 1,
      fontSize: typography.sm,
      color: colors.warning,
      fontWeight: typography.medium,
      lineHeight: 20,
    },

    primaryBtnDisabled: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },

    primaryBtnTextDisabled: {
      color: colors.textMuted,
    },

    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },

    loadingText: {
      color: colors.text,
      fontSize: typography.base,
      fontWeight: typography.medium,
    },

    stickyHeader: {
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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

    contentContainer: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },

    summaryRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },

    summaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      ...shadows.sm,
    },

    summaryValue: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: 2,
    },

    summaryLabel: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      fontWeight: typography.semibold,
    },

    createButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md + 2,
      borderRadius: borderRadius.lg,
      alignItems: "center",
      marginBottom: spacing.lg,
      ...shadows.sm,
    },

    createButtonText: {
      color: colors.textOnPrimary,
      fontSize: typography.base,
      fontWeight: typography.bold,
    },

    filterRow: {
      paddingBottom: spacing.lg,
      gap: spacing.sm,
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

    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.sm,
    },

    emptyTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    emptyText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    requestItem: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 5,
      ...shadows.sm,
    },

    requestPendingBorder: {
      borderLeftColor: colors.warning,
    },

    requestApprovedBorder: {
      borderLeftColor: colors.success,
    },

    requestRejectedBorder: {
      borderLeftColor: colors.error,
    },

    requestDefaultBorder: {
      borderLeftColor: colors.info,
    },

    requestHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.sm,
    },

    requestTitleWrap: {
      flex: 1,
    },

    employeeName: {
      fontSize: typography.sm,
      color: colors.primary,
      fontWeight: typography.bold,
      marginBottom: spacing.xs,
    },

    requestType: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    requestDates: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    statusBadge: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 1,
      borderRadius: borderRadius.full,
      alignSelf: "flex-start",
    },

    statusText: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
    },

    statusApproved: {
      backgroundColor: colors.successLight,
    },

    statusApprovedText: {
      color: colors.success,
    },

    statusRejected: {
      backgroundColor: colors.errorLight,
    },

    statusRejectedText: {
      color: colors.error,
    },

    statusPending: {
      backgroundColor: colors.warningLight,
    },

    statusPendingText: {
      color: colors.warning,
    },

    statusCancelled: {
      backgroundColor: colors.surfaceMuted,
    },

    statusCancelledText: {
      color: colors.textSecondary,
    },

    statusDefault: {
      backgroundColor: colors.infoLight,
    },

    statusDefaultText: {
      color: colors.info,
    },

    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.md,
    },

    metaPill: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },

    metaPillLabel: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      fontWeight: typography.semibold,
      marginBottom: 2,
    },

    metaPillText: {
      fontSize: typography.sm,
      color: colors.text,
      fontWeight: typography.semibold,
    },

    reasonBox: {
      marginTop: spacing.md,
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },

    reasonLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },

    requestReason: {
      fontSize: typography.sm,
      color: colors.text,
      lineHeight: 20,
    },

    commentBox: {
      marginTop: spacing.md,
      backgroundColor: colors.warningLight,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.warning,
    },

    commentLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.warning,
      marginBottom: spacing.xs,
    },

    commentText: {
      fontSize: typography.sm,
      color: colors.text,
      lineHeight: 19,
    },

    reviewButtons: {
      marginTop: spacing.md,
    },

    actionButton: {
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
    },

    reviewOpenButton: {
      backgroundColor: colors.primary,
      ...shadows.sm,
    },

    reviewOpenButtonText: {
      color: colors.textOnPrimary,
      fontSize: typography.sm,
      fontWeight: typography.bold,
    },

    modalContainer: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: colors.overlay,
    },

    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "92%",
      ...shadows.lg,
    },

    modalScrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },

    modalHandle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: borderRadius.full,
      backgroundColor: colors.border,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },

    modalTitle: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      marginBottom: spacing.xs,
      color: colors.text,
      textAlign: "center",
    },

    modalSubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: spacing.lg,
    },

    section: {
      marginBottom: spacing.lg,
    },

    label: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.sm,
    },

    typeChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },

    typeChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },

    typeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    typeChipText: {
      fontSize: typography.sm,
      color: colors.text,
      fontWeight: typography.semibold,
    },

    typeChipTextActive: {
      color: colors.textOnPrimary,
    },

    dateRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },

    dateField: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.background,
    },

    dateIconRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    dateText: {
      fontSize: typography.base,
      color: colors.text,
      fontWeight: typography.semibold,
    },

    dateFieldLabel: {
      marginTop: spacing.xs,
      fontSize: typography.xs,
      color: colors.textSecondary,
    },

    placeholderText: {
      color: colors.textMuted,
      fontWeight: typography.medium,
    },

    helperCard: {
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.info,
      borderRadius: borderRadius.md,
      padding: spacing.md,
    },

    helperLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.info,
      marginBottom: spacing.xs,
    },

    helperText: {
      fontSize: typography.sm,
      color: colors.text,
    },

    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      fontSize: typography.base,
      backgroundColor: colors.background,
      color: colors.text,
    },

    textArea: {
      minHeight: 100,
      textAlignVertical: "top",
    },

    fieldHelperText: {
      marginTop: spacing.xs,
      fontSize: typography.xs,
      color: colors.textSecondary,
    },

    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.xs,
    },

    reviewActionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.xs,
    },

    reviewThirdButton: {
      marginHorizontal: 4,
    },

    button: {
      flex: 1,
      paddingVertical: spacing.md + 2,
      borderRadius: borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
    },

    cancelBtn: {
      backgroundColor: darkMode ? colors.background : colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: spacing.sm,
    },

    primaryBtn: {
      backgroundColor: colors.primary,
      marginLeft: spacing.sm,
      ...shadows.sm,
    },

    approveButton: {
      backgroundColor: colors.success,
    },

    rejectButton: {
      backgroundColor: colors.error,
    },

    cancelBtnText: {
      color: colors.text,
      fontSize: typography.base,
      fontWeight: typography.bold,
    },

    primaryBtnText: {
      color: colors.textOnPrimary,
      fontSize: typography.base,
      fontWeight: typography.bold,
    },

    reviewButtonText: {
      color: colors.textOnPrimary,
      fontSize: typography.sm,
      fontWeight: typography.bold,
    },

    reviewSummaryCard: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },

    reviewSummaryEmployee: {
      fontSize: typography.sm,
      color: colors.primary,
      fontWeight: typography.bold,
      marginBottom: spacing.xs,
    },

    reviewSummaryType: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    reviewSummaryDates: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },

    reviewSummaryReason: {
      fontSize: typography.sm,
      color: colors.text,
      lineHeight: 20,
    },
  });