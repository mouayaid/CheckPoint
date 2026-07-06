import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Platform } from "react-native";
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
  RefreshControl,
  LayoutAnimation,
  UIManager,
  KeyboardAvoidingView,
} from "react-native";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { leaveService, profileService } from "../services/api";
import {
  roleToString,
  requestStatusToString,
  leaveTypeToInt,
  leaveTypeToString,
} from "../utils/helpers";
import { useTheme } from "../context/ThemeContext";

const LEAVE_TYPES = [
  "PaidLeave",
  "UnpaidLeave",
  "HalfDayPaidLeave",
  "HalfDayUnpaidLeave",
  "SpecialLeave",
  "MaternityLeave",
];

const HALF_DAY_TYPES = ["HalfDayPaidLeave", "HalfDayUnpaidLeave"];
const PAID_LEAVE_TYPES = ["PaidLeave", "HalfDayPaidLeave"];
const FILTERS_EMPLOYEE = ["All", "Pending", "Approved", "Rejected"];

const FILTER_LABELS_FR = {
  All: "Toutes",
  Pending: "En attente",
  Approved: "Approuvées",
  Rejected: "Rejetées",
};

const LEAVE_TYPE_LABELS_FR = {
  PaidLeave: "Congés payés",
  UnpaidLeave: "Congés sans solde",
  HalfDayPaidLeave: "Demi-journée congés payés",
  SpecialLeave: "Congés spéciaux",
  MaternityLeave: "Congés maternité",
  HalfDayUnpaidLeave: "Demi-journée sans solde",
};

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
  const current = new Date(start);
  const last = new Date(end);
  current.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);

  if (current > last) return 0;

  let workingDays = 0;
  while (current <= last) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) workingDays += 1;
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
};

const normalizeDayPeriod = (period) => {
  if (period === 1 || String(period).toLowerCase() === "morning") return "Morning";
  if (period === 2 || String(period).toLowerCase() === "afternoon") return "Afternoon";
  return "";
};

const normalizeStatus = (status) =>
  String(status || "").trim().toLowerCase();

const normalizeDateOnly = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "");

const timeToMinutes = (value) => {
  if (!isValidTime(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
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

  const { user, triggerRefresh } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();

  const openCreateModal = route?.params?.openCreateModal === true;
  const openPendingTab = route?.params?.openPendingTab === true;
  const isReviewMode = route?.params?.mode === "review";

  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [type, setType] = useState("");
  const [halfDayPeriod, setHalfDayPeriod] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [reason, setReason] = useState("");
  const [creating, setCreating] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewingAction, setReviewingAction] = useState("");

  const [activeFilter, setActiveFilter] = useState(
    openPendingTab || isReviewMode ? "Pending" : "All",
  );

  const role = roleToString(user?.role);
  const isManager = role === "Manager" || role === "Admin";
  const isHalfDay = HALF_DAY_TYPES.includes(type);
  const isPaidLeave = PAID_LEAVE_TYPES.includes(type);

  const requestedDays = getDayCount(startDate, endDate);
  const effectiveRequestedDays = isHalfDay ? 0.5 : requestedDays;
  const trimmedReason = reason.trim();

  const halfDayLabel =
    halfDayPeriod === "Morning"
      ? "Matin"
      : halfDayPeriod === "Afternoon"
        ? "Après-midi"
        : "";

  const openCreateForm = () => {
    const today = getToday();
    setType("");
    setHalfDayPeriod("");
    setFromTime("");
    setToTime("");
    setStartDate(today);
    setEndDate(today);
    setReason("");
    setShowStartPicker(false);
    setShowEndPicker(false);
    setCreating(false);
    setSubmitAttempted(false);
    setModalVisible(true);
  };

  const resetCreateModal = () => {
    setModalVisible(false);
    setType("");
    setHalfDayPeriod("");
    setFromTime("");
    setToTime("");
    setStartDate(null);
    setEndDate(null);
    setReason("");
    setShowStartPicker(false);
    setShowEndPicker(false);
    setCreating(false);
    setSubmitAttempted(false);
  };

  const resetReviewModal = () => {
    setReviewModalVisible(false);
    setReviewComment("");
    setSelectedRequest(null);
    setReviewingAction("");
  };

  const loadLeaveBalance = async () => {
    if (isReviewMode) {
      setLeaveBalance(null);
      setLoadingBalance(false);
      return;
    }

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

  const loadRequests = async () => {
    setLoadingRequests(true);

    try {
      const res = isReviewMode
        ? await leaveService.getPendingReviewRequests()
        : await leaveService.getMyLeaveRequests();

      if (res?.success) {
        const normalized = (res.data || [])
          .map((request) => ({
            ...request,
            normalizedStatus: normalizeStatus(
              requestStatusToString(request.status),
            ),
            statusLabel: requestStatusToString(request.status),
            typeLabel: leaveTypeToString(request.type),
          }))
          .filter((request) => request.normalizedStatus !== "cancelled");

        setRequests(normalized);
      } else {
        Alert.alert(
          "Erreur",
          res?.message || "Impossible de charger les demandes",
        );
      }
    } catch (error) {
      console.log("LOAD LEAVES status:", error?.status);
      console.log("LOAD LEAVES body:", error?.data);
      console.log("LOAD LEAVES message:", error?.message);

      Alert.alert(
        "Erreur",
        error?.message || "Impossible de charger les demandes",
      );
    } finally {
      setLoadingRequests(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadRequests();
        loadLeaveBalance();
      }
    }, [user, isReviewMode]),
  );

  useEffect(() => {
    if (isReviewMode) return;

    if (!loadingBalance && openCreateModal) {
      openCreateForm();
      navigation.setParams({ openCreateModal: false });
    }
  }, [isReviewMode, openCreateModal, loadingBalance, leaveBalance, navigation]);

  useEffect(() => {
    if (openPendingTab || isReviewMode) {
      setActiveFilter("Pending");
      setModalVisible(false);
      navigation.setParams({ openPendingTab: false });
    }
  }, [openPendingTab, isReviewMode, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadRequests(), loadLeaveBalance()]);
    } finally {
      setRefreshing(false);
    }
  };

  const formValidationMessage = useMemo(() => {
    if (isPaidLeave && leaveBalance !== null && leaveBalance <= 0) {
      return "Vous ne disposez plus de jours de congé.";
    }

    if (!type) {
      return "Veuillez sélectionner un type de congé.";
    }

    if (!startDate) {
      return "Veuillez sélectionner une date de début.";
    }

    if (!endDate) {
      return "Veuillez sélectionner une date de fin.";
    }

    if (isHalfDay && !halfDayPeriod) {
      return "Veuillez sélectionner la période : matin ou après-midi.";
    }

    if (isHalfDay && (!isValidTime(fromTime) || !isValidTime(toTime))) {
      return "Veuillez saisir les heures au format HH:mm.";
    }

    if (isHalfDay && timeToMinutes(fromTime) >= timeToMinutes(toTime)) {
      return "L'heure de fin doit être supérieure à l'heure de début.";
    }

    if (
      isHalfDay &&
      ((halfDayPeriod === "Morning" && (fromTime !== "08:00" || toTime !== "12:00")) ||
        (halfDayPeriod === "Afternoon" && (fromTime !== "13:00" || toTime !== "17:00")))
    ) {
      return "Les horaires de demi-journée sont fixes selon la période sélectionnée.";
    }

    if (!trimmedReason) {
      return "Veuillez saisir le motif de votre demande.";
    }

    if (trimmedReason.length < 5) {
      return "Le motif doit contenir au moins 5 caractères";
    }

    if (trimmedReason.length > 300) {
      return "Le motif doit contenir moins de 300 caractères";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normalizedStart = normalizeDateOnly(startDate);
    const normalizedEnd = normalizeDateOnly(endDate);

    if (normalizedStart < today) {
      return "La date de début ne peut pas être dans le passé";
    }

    if (normalizedEnd < normalizedStart) {
      return "La date de fin doit être après la date de début.";
    }

    if (!isHalfDay && requestedDays === 0) {
      return "La période de congé doit contenir au moins un jour ouvrable.";
    }

    if (
      isPaidLeave &&
      leaveBalance !== null &&
      effectiveRequestedDays !== null &&
      effectiveRequestedDays > leaveBalance
    ) {
      return `Il vous reste seulement ${leaveBalance} jour${
        leaveBalance === 1 ? "" : "s"
      } de congé`;
    }

    const hasOverlap = requests.some((request) => {
      const status = normalizeStatus(request.statusLabel);
      if (status !== "pending" && status !== "approved") return false;

      const requestStart = normalizeDateOnly(request.startDate);
      const requestEnd = normalizeDateOnly(request.endDate);

      if (!(normalizedStart <= requestEnd && normalizedEnd >= requestStart)) {
        return false;
      }

      const existingType = leaveTypeToString(
        request.type ?? request.leaveType ?? request.Type,
      );
      const existingIsHalfDay = HALF_DAY_TYPES.includes(existingType);

      if (!isHalfDay || !existingIsHalfDay) return true;

      const existingPeriod = normalizeDayPeriod(
        request.dayPeriod ?? request.DayPeriod ?? request.dayPeriodLabel,
      );

      return !existingPeriod || existingPeriod === halfDayPeriod;
    });

    if (hasOverlap) {
      return "Vous avez déjà une demande de congé en attente ou approuvée qui chevauche ces dates.";
    }

    return null;
  }, [
    startDate,
    endDate,
    trimmedReason,
    leaveBalance,
    effectiveRequestedDays,
    requests,
    isHalfDay,
    isPaidLeave,
    type,
    halfDayPeriod,
    fromTime,
    toTime,
    requestedDays,
  ]);

  const isCreateDisabled =
    creating ||
    loadingBalance ||
    (isPaidLeave && (leaveBalance === null || leaveBalance <= 0));

  const handleCreate = async () => {
    setSubmitAttempted(true);

    if (formValidationMessage) {
      Alert.alert("Erreur", formValidationMessage);
      return;
    }

    setCreating(true);

    try {
      const payload = {
        type: leaveTypeToInt(type),
        startDate: startDate.toISOString(),
        endDate: isHalfDay ? startDate.toISOString() : endDate.toISOString(),
        reason: trimmedReason,
      };

      if (isHalfDay) {
        payload.dayPeriod = halfDayPeriod;
        payload.fromTime = fromTime;
        payload.toTime = toTime;
        payload.halfDayPeriod = halfDayPeriod;
        payload.startTime = fromTime;
        payload.endTime = toTime;
      }

      const res = await leaveService.createLeaveRequest(payload);

      if (res?.success) {
        Alert.alert("Succès", "Demande de congé créée");
        resetCreateModal();
        triggerRefresh();
        await Promise.all([loadRequests(), loadLeaveBalance()]);
      } else {
        Alert.alert("Erreur", res?.message || "Impossible de créer la demande");
      }
    } catch (error) {
      console.log("CREATE LEAVE status:", error.response?.status);
      console.log("CREATE LEAVE body:", error.response?.data);
      Alert.alert(
        "Erreur",
        error.response?.data?.message ||
          error.message ||
          "Impossible de créer la demande",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleReview = async (status) => {
    if (!selectedRequest?.id) {
      Alert.alert("Erreur", "Aucune demande sélectionnée");
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

      if (res?.success) {
        Alert.alert("Succès", `Demande ${String(status).toLowerCase()}`);
        resetReviewModal();
        triggerRefresh();
        await Promise.all([loadRequests(), loadLeaveBalance()]);
      } else {
        Alert.alert(
          "Erreur",
          res?.data?.message ||
            res?.message ||
            "Impossible de traiter la demande",
        );
      }
    } catch (error) {
      console.log("REVIEW LEAVE status:", error.response?.status);
      console.log("REVIEW LEAVE body:", error.response?.data);
      Alert.alert(
        "Erreur",
        error.response?.data?.message ||
          error.message ||
          "Impossible de traiter la demande",
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
        label: "Approuvée",
      };
    }

    if (normalized === "rejected") {
      return {
        badge: styles.statusRejected,
        text: styles.statusRejectedText,
        border: styles.requestRejectedBorder,
        label: "Rejetée",
      };
    }

    if (normalized === "pending") {
      return {
        badge: styles.statusPending,
        text: styles.statusPendingText,
        border: styles.requestPendingBorder,
        label: "En attente",
      };
    }

    if (normalized === "cancelled") {
      return {
        badge: styles.statusCancelled,
        text: styles.statusCancelledText,
        border: styles.requestDefaultBorder,
        label: "Annulée",
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

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.stickyHeader}>
        <Text style={styles.screenTitle}>
          {isReviewMode ? "Congés en attente" : "Demandes de congé"}
        </Text>
        <Text style={styles.screenSubtitle}>
          {isReviewMode
            ? "Consultez et traitez les demandes de congé en attente"
            : "Créez et suivez vos demandes de congé"}
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
        {!isReviewMode && (
          <>
            <TouchableOpacity
              style={styles.createButton}
              activeOpacity={0.9}
              onPress={() => {
                if (loadingBalance) return;
                openCreateForm();
              }}
            >
              <Text style={styles.createButtonText}>
                {loadingBalance
                  ? "Vérification du solde..."
                  : "+ Créer une demande"}
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
                  Vous ne disposez plus de jours de congé.
                </Text>
              </View>
            )}
          </>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS_EMPLOYEE.map((filter) => {
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
                  {FILTER_LABELS_FR[filter] ?? filter} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loadingRequests ? (
          <View style={[styles.emptyCard, { paddingVertical: spacing.xl }]}>
            <Text style={styles.emptyText}>Chargement des demandes...</Text>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {isReviewMode
                ? "Aucune demande en attente"
                : "Aucune demande de congé trouvée"}
            </Text>
            <Text style={styles.emptyText}>
              {isReviewMode
                ? "Il n'y a actuellement aucune demande de congé à traiter."
                : "Essayez un autre filtre ou créez votre première demande de congé."}
            </Text>
          </View>
        ) : (
          filteredRequests.map((request) => {
            const statusStyle = getStatusStyles(request.statusLabel);
            const dayCount = getDayCount(request.startDate, request.endDate);
            const isRequestHalfDay = HALF_DAY_TYPES.includes(request.typeLabel);

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

                    <Text style={styles.requestType}>
                      {LEAVE_TYPE_LABELS_FR[request.typeLabel] ??
                        request.typeLabel}
                    </Text>

                    <Text style={styles.requestDates}>
                      {formatDateReadable(request.startDate)}
                      {!isRequestHalfDay &&
                        ` - ${formatDateReadable(request.endDate)}`}
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
                    <Text style={styles.metaPillLabel}>Durée</Text>
                    <Text style={styles.metaPillText}>
                      {isRequestHalfDay
                        ? "0.5 jour"
                        : `${dayCount} ${dayCount === 1 ? "jour" : "jours"}`}
                    </Text>
                  </View>

                  {!!request.createdAt && (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Soumise</Text>
                      <Text style={styles.metaPillText}>
                        {formatDateReadable(request.createdAt)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Motif</Text>
                  <Text style={styles.requestReason}>{request.reason}</Text>
                </View>

                {!!request.managerComment && (
                  <View style={styles.commentBox}>
                    <Text style={styles.commentLabel}>
                      Commentaire du responsable
                    </Text>
                    <Text style={styles.commentText}>
                      {request.managerComment}
                    </Text>
                  </View>
                )}

                {isReviewMode && request.normalizedStatus === "pending" && (
                  <View style={styles.reviewButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.reviewOpenButton]}
                      activeOpacity={0.9}
                      onPress={() => {
                        setSelectedRequest(request);
                        setReviewModalVisible(true);
                      }}
                    >
                      <Text style={styles.reviewOpenButtonText}>
                        Traiter la demande
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={resetCreateModal}
          />
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
                <Text style={styles.modalTitle}>Nouvelle demande de congé</Text>
                <Text style={styles.modalSubtitle}>
                  Renseignez les détails de votre demande
                </Text>

                <View style={styles.balanceInfoCard}>
                  <Text style={styles.balanceInfoLabel}>Solde disponible :</Text>
                  <Text style={styles.balanceInfoValue}>
                    {loadingBalance
                      ? "Chargement..."
                      : `${leaveBalance ?? 0} jour${
                          leaveBalance === 1 ? "" : "s"
                        }`}
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Type de congé</Text>

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
                          onPress={() => {
                            setType(item);

                            if (HALF_DAY_TYPES.includes(item)) {
                              setEndDate(startDate);
                              setHalfDayPeriod("");
                              setFromTime("");
                              setToTime("");
                            } else {
                              setHalfDayPeriod("");
                              setFromTime("");
                              setToTime("");
                              if (startDate && !endDate) {
                                setEndDate(startDate);
                              }
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.typeChipText,
                              selected && styles.typeChipTextActive,
                            ]}
                          >
                            {LEAVE_TYPE_LABELS_FR[item] ?? item}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {isHalfDay && (
                  <View style={styles.section}>
                    <Text style={styles.label}>Période</Text>

                    <View style={styles.typeChipRow}>
                      {[
                        {
                          key: "Morning",
                          label: "Matin",
                          time: "08:00 - 12:00",
                        },
                        {
                          key: "Afternoon",
                          label: "Après-midi",
                          time: "13:00 - 17:00",
                        },
                      ].map((period) => {
                        const selected = halfDayPeriod === period.key;

                        return (
                          <TouchableOpacity
                            key={period.key}
                            style={[
                              styles.typeChip,
                              selected && styles.typeChipActive,
                            ]}
                            activeOpacity={0.85}
                            onPress={() => {
                              setHalfDayPeriod(period.key);
                              if (period.key === "Morning") {
                                setFromTime("08:00");
                                setToTime("12:00");
                              } else {
                                setFromTime("13:00");
                                setToTime("17:00");
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.typeChipText,
                                selected && styles.typeChipTextActive,
                              ]}
                            >
                              {period.label}
                            </Text>
                            <Text
                              style={[
                                styles.fieldHelperText,
                                selected && { color: colors.textOnPrimary },
                              ]}
                            >
                              {period.time}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.timeRow}>
                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>De</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={fromTime}
                          placeholder="08:00"
                          placeholderTextColor={colors.textTertiary}
                          editable={false}
                        />
                      </View>

                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>À</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={toTime}
                          placeholder="12:00"
                          placeholderTextColor={colors.textTertiary}
                          editable={false}
                        />
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.label}>{isHalfDay ? "Date" : "Dates"}</Text>

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
                          {startDate
                            ? formatDateValue(startDate)
                            : isHalfDay
                              ? "Date"
                              : "Date de début"}
                        </Text>
                      </View>
                      <Text style={styles.dateFieldLabel}>
                        {isHalfDay ? "Date" : "Début"}
                      </Text>
                    </Pressable>

                    {!isHalfDay && (
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
                            {endDate
                              ? formatDateValue(endDate)
                              : "Date de fin"}
                          </Text>
                        </View>
                        <Text style={styles.dateFieldLabel}>Fin</Text>
                      </Pressable>
                    )}
                  </View>

                  {(isHalfDay ? startDate : startDate && endDate) && (
                    <View style={styles.helperCard}>
                      <Text style={styles.helperLabel}>Durée</Text>
                        <Text style={styles.helperText}>
                        {isHalfDay
                          ? `0.5 jour${
                              halfDayLabel ? ` - ${halfDayLabel}` : ""
                            }${fromTime && toTime ? ` (${fromTime} - ${toTime})` : ""}`
                          : `${requestedDays} ${
                              requestedDays === 1 ? "jour" : "jours"
                            }`}
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

                        if (isHalfDay) {
                          setEndDate(date);
                        } else if (endDate && date && endDate < date) {
                          setEndDate(date);
                        }
                      }}
                    />
                  )}

                  {showEndPicker && !isHalfDay && (
                    <DateTimePicker
                      value={endDate || startDate || new Date()}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      minimumDate={new Date()}
                      onChange={(event, date) => {
                        setShowEndPicker(false);
                        if (event.type === "dismissed") return;
                        setEndDate(date);
                      }}
                    />
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Motif</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Écrivez un motif court..."
                    placeholderTextColor={colors.textTertiary}
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    maxLength={300}
                  />
                  <Text style={styles.fieldHelperText}>
                    Ajoutez une explication courte et claire (
                    {trimmedReason.length}/300).
                  </Text>
                </View>

                {submitAttempted &&
                  !!formValidationMessage &&
                  !(
                    formValidationMessage ===
                      "Veuillez remplir tous les champs" &&
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
                    <Text style={styles.cancelBtnText}>Annuler</Text>
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
                      {creating ? "Création..." : "Créer"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        transparent
        onRequestClose={resetReviewModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={resetReviewModal}
          />
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
                <Text style={styles.modalTitle}>Traiter la demande</Text>
                <Text style={styles.modalSubtitle}>
                  Ajoutez un commentaire optionnel et choisissez une action
                </Text>

                {selectedRequest && (
                  <View style={styles.reviewSummaryCard}>
                    {!!selectedRequest.employeeName && (
                      <Text style={styles.reviewSummaryEmployee}>
                        {selectedRequest.employeeName}
                      </Text>
                    )}

                    <Text style={styles.reviewSummaryType}>
                      {LEAVE_TYPE_LABELS_FR[
                        leaveTypeToString(selectedRequest.type)
                      ] ?? leaveTypeToString(selectedRequest.type)}
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
                  <Text style={styles.label}>
                    Commentaire du responsable (optionnel)
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Écrivez un commentaire court..."
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
                    <Text style={styles.cancelBtnText}>Annuler</Text>
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
                      {reviewingAction === "Rejected" ? "Rejet..." : "Rejeter"}
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
                        ? "Approbation..."
                        : "Approuver"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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

    balanceInfoCard: {
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.info,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },

    balanceInfoLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.info,
      marginBottom: spacing.xs,
    },

    balanceInfoValue: {
      fontSize: typography.lg,
      color: colors.text,
      fontWeight: typography.bold,
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

    timeRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
    },

    timeField: {
      flex: 1,
    },

    timeLabel: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      fontWeight: typography.bold,
      marginBottom: spacing.xs,
    },

    timeInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      fontSize: typography.base,
      backgroundColor: colors.background,
      color: colors.text,
      fontWeight: typography.semibold,
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
