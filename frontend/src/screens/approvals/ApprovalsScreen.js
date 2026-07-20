import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  LayoutAnimation,
  Platform,
  UIManager,
  KeyboardAvoidingView,
} from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../components";
import { useTheme } from "../../context/ThemeContext";
import api from "../../services/api/axiosInstance";
import { useRoles } from "../../hooks/useRoles";
import { leaveTypeToString } from "../../utils/helpers";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ROLE_OPTIONS = [
  { label: "Employé", value: 1, icon: "person-outline" },
  { label: "Manager", value: 2, icon: "people-outline" },
  { label: "Admin", value: 3, icon: "shield-checkmark-outline" },
];

const GENERAL_REQUEST_CATEGORIES = [
  { label: "Autorisation de sortie", value: 1, name: "ExitAuthorization" },
  { label: "Récupération", value: 2, name: "Recovery" },
  { label: "Télétravail", value: 3, name: "RemoteWork" },
  { label: "Documents", value: 4, name: "Document" },
];

const ADMIN_ROLE_ID = 3;

const REQUEST_SUBTYPE_FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "leave", label: "Congés" },
  { key: "RemoteWork", label: "Télétravail" },
  { key: "ExitAuthorization", label: "Sorties" },
  { key: "Recovery", label: "Récupérations" },
  { key: "Document", label: "Documents" },
];

const DEFAULT_LEAVE_BALANCE = "18";
const DEFAULT_YEARLY_SALARY = "50000";
const LEAVE_TYPE_LABELS_FR = {
  PaidLeave: "Congés payés",
  UnpaidLeave: "Congés sans solde",
  HalfDayPaidLeave: "Demi-journée congés payés",
  SpecialLeave: "Congés spéciaux",
  MaternityLeave: "Congés maternité",
  HalfDayUnpaidLeave: "Demi-journée sans solde",
};
const DAY_PERIOD_LABELS_FR = {
  Morning: "Matin",
  Afternoon: "Après-midi",
  1: "Matin",
  2: "Après-midi",
};
const RECOVERY_NATURE_LABELS_FR = {
  SpecialLeave: "Congé spécial",
  PaidLeave: "Congé payé",
  UnpaidLeave: "Congé sans solde",
  MaternityLeave: "Congé maternité",
};
const RECOVERY_PERMUTATION_LABELS_FR = {
  Leave: "Congé",
  Authorization: "Autorisation de sortie",
};

const formatRequestedDays = (days) => {
  const value = Number(days);
  if (Number.isNaN(value)) return "";
  return String(value).replace(".", ",");
};

const formatDurationMinutes = (minutes) => {
  const value = Number(minutes);
  if (Number.isNaN(value) || value <= 0) return "";

  const roundedValue = Math.round(value);
  const hours = Math.floor(roundedValue / 60);
  const remainingMinutes = roundedValue % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours} h ${remainingMinutes} min`;
  }

  if (hours > 0) {
    return `${hours} h`;
  }

  return `${remainingMinutes} min`;
};

const normalizeRecoverySlots = (slots) => {
  if (Array.isArray(slots)) return slots;

  if (typeof slots === "string") {
    try {
      const parsedSlots = JSON.parse(slots);
      return Array.isArray(parsedSlots) ? parsedSlots : [];
    } catch {
      return [];
    }
  }

  return [];
};

const formatRecoveryTime = (value) => {
  if (!value) return "";
  return String(value).slice(0, 5);
};

const parseRecoveryTimeToMinutes = (value) => {
  const formattedTime = formatRecoveryTime(value);
  const [hours, minutes] = formattedTime.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const getRecoverySlotMinutes = (slot) => {
  const explicitMinutes = Number(slot?.minutes ?? slot?.Minutes);

  if (!Number.isNaN(explicitMinutes) && explicitMinutes > 0) {
    return explicitMinutes;
  }

  const startMinutes = parseRecoveryTimeToMinutes(
    slot?.startTime ?? slot?.StartTime,
  );
  const endMinutes = parseRecoveryTimeToMinutes(slot?.endTime ?? slot?.EndTime);

  if (
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes
  ) {
    return null;
  }

  return endMinutes - startMinutes;
};

const normalizeMainFilterParam = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    ["demandes", "requests", "general", "leave", "leaves"].includes(normalized)
  ) {
    return "general";
  }

  if (["utilisateurs", "users"].includes(normalized)) {
    return "users";
  }

  if (["tout", "all"].includes(normalized)) {
    return "all";
  }

  return null;
};

const normalizeRequestTypeParam = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized || ["all", "toutes", "tout"].includes(normalized)) {
    return "all";
  }

  if (
    [
      "conge",
      "congé",
      "conges",
      "congés",
      "leave",
      "leaves",
      "leaverequest",
    ].includes(normalized)
  ) {
    return "leave";
  }

  const category = GENERAL_REQUEST_CATEGORIES.find((entry) => {
    const label = entry.label.toLowerCase();
    const name = entry.name.toLowerCase();

    return (
      name === normalized ||
      label === normalized ||
      (entry.name === "ExitAuthorization" &&
        ["sortie", "sorties"].includes(normalized)) ||
      (entry.name === "Document" &&
        ["documents", "document"].includes(normalized))
    );
  });

  return category?.name ?? "all";
};

const ApprovalsScreen = ({ pagerParams } = {}) => {
  const route = useRoute();
  const navigationParams = pagerParams ?? route.params ?? {};
  const { isAdmin } = useRoles();

  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const [activeTab, setActiveTab] = useState("all");
  const [requestSubtypeFilter, setRequestSubtypeFilter] = useState("all");
  useEffect(() => {
    const legacyFilter = String(navigationParams.filter ?? "").toLowerCase();
    const nextTab = normalizeMainFilterParam(
      navigationParams.mainFilter ?? navigationParams.filter,
    );
    const nextSubtype = normalizeRequestTypeParam(
      navigationParams.requestType ??
        (legacyFilter === "leaves" ? "leave" : undefined),
    );

    if (nextTab) {
      setActiveTab(nextTab);
    }

    if (nextTab === "general" || navigationParams.requestType) {
      setRequestSubtypeFilter(nextSubtype);
    } else if (nextTab) {
      setRequestSubtypeFilter("all");
    }
  }, [
    navigationParams.filter,
    navigationParams.mainFilter,
    navigationParams.requestType,
  ]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [generalRequests, setGeneralRequests] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [leaveActionState, setLeaveActionState] = useState({});
  const [generalActionState, setGeneralActionState] = useState({});
  const [userActionState, setUserActionState] = useState({});
  const [formByUserId, setFormByUserId] = useState({});
  const requestSubtypeScrollRef = useRef(null);
  const requestSubtypeScrollOffsetRef = useRef(0);
  const requestSubtypePendingRestoreOffsetRef = useRef(null);
  const requestSubtypeRestoreFrameRef = useRef(null);

  const toggleExpanded = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setExpandedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const normalizeDate = (value) => {
    if (!value) return "Date inconnue";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("fr-FR");
  };

  const normalizeDateRange = (start, end) => {
    return `${normalizeDate(start)} -> ${normalizeDate(end)}`;
  };

  const extractArray = (res) => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    return [];
  };

  const getUserId = (item) => item?.id ?? item?.Id;
  const getItemId = (item) => item?.id ?? item?.Id;

  const getErrorMessage = (error, fallback) => {
    return (
      error?.response?.data?.message || error?.response?.data?.title || fallback
    );
  };

  const normalizeRoleValue = (role) => {
    if (typeof role === "number") return role;

    if (typeof role === "string") {
      const lowered = role.trim().toLowerCase();

      if (lowered === "employee" || lowered === "employé" || lowered === "user")
        return 1;

      if (lowered === "manager") return 2;
      if (lowered === "admin") return 3;
    }

    return 1;
  };

  const getRoleMeta = (value) => {
    return ROLE_OPTIONS.find((r) => r.value === value) || ROLE_OPTIONS[0];
  };

  const loadApprovals = useCallback(
    async (isRefresh = false) => {
      if (!isAdmin) {
        setLeaveRequests([]);
        setGeneralRequests([]);
        setPendingUsers([]);
        setDepartments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const [leaveRes, generalRes, usersRes, depsRes] =
          await Promise.allSettled([
            api.get("/Leave/pending-review"),
            api.get("/GeneralRequests", { params: { status: "Pending" } }),
            api.get("/admin/users/pending"),
            api.get("/Departments"),
          ]);

        let leaveData = [];
        let generalData = [];
        let usersData = [];
        let depsData = [];

        if (leaveRes.status === "fulfilled") {
          leaveData = extractArray(leaveRes.value);
        }

        if (generalRes.status === "fulfilled") {
          generalData = extractArray(generalRes.value);
        }

        if (usersRes.status === "fulfilled") {
          usersData = extractArray(usersRes.value);
        }

        if (depsRes.status === "fulfilled") {
          depsData = extractArray(depsRes.value).map((d) => ({
            label: d.name || d.Name || "Inconnu",
            value: d.id ?? d.Id,
          }));
        }

        setLeaveRequests(leaveData);
        setGeneralRequests(generalData);
        setPendingUsers(usersData);
        setDepartments(depsData);

        setFormByUserId((prev) => {
          const next = { ...prev };

          usersData.forEach((user) => {
            const userId = getUserId(user);

            if (!next[userId]) {
              next[userId] = {
                leaveBalance: DEFAULT_LEAVE_BALANCE,
                yearlySalary: DEFAULT_YEARLY_SALARY,
                role: normalizeRoleValue(
                  user?.roleId ?? user?.RoleId ?? user?.role ?? user?.Role,
                ),
                departmentId: null,
              };
            }
          });

          return next;
        });
      } catch (error) {
        Alert.alert(
          "Erreur",
          getErrorMessage(error, "Impossible de charger les approbations."),
        );

        setLeaveRequests([]);
        setGeneralRequests([]);
        setPendingUsers([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin],
  );

  useFocusEffect(
    useCallback(() => {
      loadApprovals();
    }, [loadApprovals]),
  );

  const onRefresh = useCallback(async () => {
    await loadApprovals(true);
  }, [loadApprovals]);

  const restoreRequestSubtypeScrollOffset = useCallback(() => {
    if (activeTab !== "general") {
      return;
    }

    const offset =
      requestSubtypePendingRestoreOffsetRef.current ??
      requestSubtypeScrollOffsetRef.current;

    if (!requestSubtypeScrollRef.current || offset <= 1) {
      return;
    }

    if (requestSubtypeRestoreFrameRef.current) {
      cancelAnimationFrame(requestSubtypeRestoreFrameRef.current);
    }

    requestSubtypeRestoreFrameRef.current = requestAnimationFrame(() => {
      requestSubtypeScrollRef.current?.scrollTo({
        x: offset,
        y: 0,
        animated: false,
      });
      requestSubtypeScrollOffsetRef.current = offset;
      requestSubtypePendingRestoreOffsetRef.current = null;
      requestSubtypeRestoreFrameRef.current = null;
    });
  }, [activeTab]);

  useEffect(() => {
    restoreRequestSubtypeScrollOffset();

    return () => {
      if (requestSubtypeRestoreFrameRef.current) {
        cancelAnimationFrame(requestSubtypeRestoreFrameRef.current);
        requestSubtypeRestoreFrameRef.current = null;
      }
    };
  }, [requestSubtypeFilter, restoreRequestSubtypeScrollOffset]);

  const updateForm = useCallback((userId, field, value) => {
    setFormByUserId((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  }, []);

  const setLeaveAction = (requestId, action) => {
    setLeaveActionState((prev) => ({
      ...prev,
      [requestId]: action,
    }));
  };

  const clearLeaveAction = (requestId) => {
    setLeaveActionState((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  };

  const getGeneralCategoryLabel = (category) => {
    const item = GENERAL_REQUEST_CATEGORIES.find(
      (entry) =>
        entry.value === category ||
        entry.name.toLowerCase() === String(category).toLowerCase(),
    );

    return item?.label ?? "Autre";
  };

  const getGeneralCategoryName = (category) => {
    const item = GENERAL_REQUEST_CATEGORIES.find(
      (entry) =>
        entry.value === category ||
        entry.name.toLowerCase() === String(category).toLowerCase(),
    );

    return item?.name ?? null;
  };

  const setGeneralAction = (requestId, action) => {
    setGeneralActionState((prev) => ({
      ...prev,
      [requestId]: action,
    }));
  };

  const clearGeneralAction = (requestId) => {
    setGeneralActionState((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  };

  const approveLeave = async (item) => {
    const requestId = getItemId(item);
    try {
      setLeaveAction(requestId, "approving");

      await api.put(`/Leave/requests/${requestId}/approve`, {
        comment: "Approved by Admin",
      });

      setLeaveRequests((prev) =>
        prev.filter((request) => getItemId(request) !== requestId),
      );
    } catch (error) {
      Alert.alert(
        "Erreur",
        getErrorMessage(error, "Impossible d'approuver la demande de congé."),
      );
    } finally {
      clearLeaveAction(requestId);
    }
  };

  const rejectLeave = async (item) => {
    const requestId = getItemId(item);

    try {
      setLeaveAction(requestId, "rejecting");

      await api.put(`/Leave/requests/${requestId}/reject`, {
        comment: "Rejected by Admin",
      });

      setLeaveRequests((prev) =>
        prev.filter((request) => getItemId(request) !== requestId),
      );
    } catch (error) {
      Alert.alert(
        "Erreur",
        getErrorMessage(error, "Impossible de rejeter la demande de congé."),
      );
    } finally {
      clearLeaveAction(requestId);
    }
  };

  const approveGeneralRequest = async (item) => {
    const requestId = getItemId(item);

    try {
      setGeneralAction(requestId, "approving");

      await api.put(`/GeneralRequests/${requestId}/approve`, {
        comment: "Approved by Admin",
      });

      setGeneralRequests((prev) =>
        prev.filter((request) => getItemId(request) !== requestId),
      );
    } catch (error) {
      Alert.alert(
        "Erreur",
        getErrorMessage(error, "Impossible d'approuver la demande générale."),
      );
    } finally {
      clearGeneralAction(requestId);
    }
  };

  const rejectGeneralRequest = async (item) => {
    const requestId = getItemId(item);

    try {
      setGeneralAction(requestId, "rejecting");

      await api.put(`/GeneralRequests/${requestId}/reject`, {
        comment: "Rejected by Admin",
      });

      setGeneralRequests((prev) =>
        prev.filter((request) => getItemId(request) !== requestId),
      );
    } catch (error) {
      Alert.alert(
        "Erreur",
        getErrorMessage(error, "Impossible de rejeter la demande générale."),
      );
    } finally {
      clearGeneralAction(requestId);
    }
  };

  const setUserAction = (userId, action) => {
    setUserActionState((prev) => ({
      ...prev,
      [userId]: action,
    }));
  };

  const clearUserAction = (userId) => {
    setUserActionState((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const approveUser = async (user) => {
    const userId = getUserId(user);
    const form = formByUserId[userId] || {};
    const isAdminApproval = form.role === ADMIN_ROLE_ID;

    let leaveBalance = null;

    if (!isAdminApproval) {
      const rawLeaveBalance = String(form.leaveBalance ?? "").trim();
      leaveBalance = Number(rawLeaveBalance);

      if (
        rawLeaveBalance === "" ||
        Number.isNaN(leaveBalance) ||
        leaveBalance < 0
      ) {
        Alert.alert("Validation", "Veuillez saisir un solde de congés valide.");
        return;
      }
    }

    const rawYearlySalary = String(form.yearlySalary ?? "").trim();
    const yearlySalary = Number(rawYearlySalary);

    if (
      rawYearlySalary === "" ||
      Number.isNaN(yearlySalary) ||
      yearlySalary <= 0
    ) {
      Alert.alert("Validation", "Veuillez saisir un salaire annuel valide.");
      return;
    }

    if (!isAdminApproval && !form.departmentId) {
      Alert.alert(
        "Validation",
        "Veuillez choisir un département avant d'approuver l'utilisateur.",
      );
      return;
    }

    try {
      setUserAction(userId, "approving");

      await api.put(`/admin/users/${userId}/approve`, {
        leaveBalance: isAdminApproval ? null : leaveBalance,
        yearlySalary,
        roleId: form.role,
        departmentId: isAdminApproval ? null : form.departmentId,
      });

      setPendingUsers((prev) => prev.filter((u) => getUserId(u) !== userId));
    } catch (error) {
      Alert.alert(
        "Erreur",
        getErrorMessage(error, "Impossible d'approuver cet utilisateur."),
      );
    } finally {
      clearUserAction(userId);
    }
  };

  const rejectUser = async (user) => {
    const userId = getUserId(user);

    Alert.alert(
      "Rejeter l'utilisateur",
      "Êtes-vous sûr de vouloir rejeter cette demande de compte ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Rejeter",
          style: "destructive",
          onPress: async () => {
            try {
              setUserAction(userId, "rejecting");

              await api.put(`/admin/users/${userId}/reject`, {
                reason: "Rejeté par l'Admin",
              });

              setPendingUsers((prev) =>
                prev.filter((u) => getUserId(u) !== userId),
              );
            } catch (error) {
              Alert.alert(
                "Erreur",
                getErrorMessage(
                  error,
                  "Impossible de rejeter cet utilisateur.",
                ),
              );
            } finally {
              clearUserAction(userId);
            }
          },
        },
      ],
    );
  };

  const renderRoleOption = (userId, option, selectedRole, disabled) => {
    const selected = selectedRole === option.value;

    return (
      <TouchableOpacity
        key={option.value}
        activeOpacity={0.85}
        disabled={disabled}
        onPress={() => {
          updateForm(userId, "role", option.value);

          if (option.value === ADMIN_ROLE_ID) {
            updateForm(userId, "departmentId", null);
            updateForm(userId, "leaveBalance", null);
          } else if (!formByUserId[userId]?.leaveBalance) {
            updateForm(userId, "leaveBalance", DEFAULT_LEAVE_BALANCE);
          }
        }}
        style={[
          styles.roleChip,
          selected && styles.roleChipSelected,
          disabled && styles.disabledChip,
        ]}
      >
        <Ionicons
          name={option.icon}
          size={14}
          color={selected ? colors.textOnPrimary : colors.textSecondary}
        />

        <Text
          style={[styles.roleChipText, selected && styles.roleChipTextSelected]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDepartmentOption = (userId, option, selectedDept, disabled) => {
    const selected = selectedDept === option.value;

    return (
      <TouchableOpacity
        key={option.value}
        activeOpacity={0.85}
        disabled={disabled}
        onPress={() => updateForm(userId, "departmentId", option.value)}
        style={[
          styles.roleChip,
          selected && styles.roleChipSelected,
          disabled && styles.disabledChip,
          { marginRight: 8 },
        ]}
      >
        <Ionicons
          name="business-outline"
          size={14}
          color={selected ? colors.textOnPrimary : colors.textSecondary}
        />

        <Text
          style={[styles.roleChipText, selected && styles.roleChipTextSelected]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderLeaveCard = (item) => {
    const requestId = getItemId(item);
    const rowKey = `leave-${requestId}`;
    const expanded = !!expandedItems[rowKey];

    const action = leaveActionState[requestId];
    const isApproving = action === "approving";
    const isRejecting = action === "rejecting";
    const isBusy = !!action;
    const userName =
      item?.userName ?? item?.UserName ?? `Utilisateur #${item?.userId ?? ""}`;

    const typeName = leaveTypeToString(
      item?.type ?? item?.leaveType ?? item?.Type,
    );
    const leaveType = LEAVE_TYPE_LABELS_FR[typeName] ?? typeName ?? "Congé";
    const requestedDays = item?.requestedDays ?? item?.RequestedDays;
    const dayPeriod = item?.dayPeriod ?? item?.DayPeriod;
    const dayPeriodLabel =
      DAY_PERIOD_LABELS_FR[dayPeriod] ??
      DAY_PERIOD_LABELS_FR[item?.dayPeriodLabel ?? item?.DayPeriodLabel];
    const fromTime = item?.fromTime ?? item?.FromTime;
    const toTime = item?.toTime ?? item?.ToTime;
    const reason = item?.reason ?? item?.Reason ?? "Aucun motif fourni";
    const createdAt = item?.createdAt ?? item?.CreatedAt;

    return (
      <Card
        testID={`approvals.leaveCard.${requestId}`}
        style={[styles.card, !expanded && styles.compactCard]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => toggleExpanded(rowKey)}
          style={styles.compactRow}
        >
          <View style={styles.avatarWrap}>
            <Ionicons
              name="calendar-clear-outline"
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.headerTextWrap}>
            <Text style={styles.name}>Congé</Text>
            <Text style={styles.email}>{userName}</Text>
            <Text style={styles.smallPreview}>
              {normalizeDateRange(item?.startDate, item?.endDate)}
            </Text>
            <Text style={styles.smallPreview} numberOfLines={1}>
              {reason}
            </Text>
          </View>

          <View style={styles.rowRight}>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>En attente</Text>
            </View>

            <Ionicons
              name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
              size={22}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.infoBlock}>
              <View style={styles.metaRow}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.metaText}>
                  {normalizeDateRange(item?.startDate, item?.endDate)}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons
                  name="folder-open-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.metaText}>
                  Nature de demande : {leaveType}
                </Text>
              </View>

              {requestedDays !== undefined && requestedDays !== null && (
                <View style={styles.metaRow}>
                  <Ionicons
                    name="calculator-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.metaText}>
                    Nombre de jours : {formatRequestedDays(requestedDays)}
                  </Text>
                </View>
              )}

              {!!dayPeriodLabel && (
                <View style={styles.metaRow}>
                  <Ionicons
                    name="partly-sunny-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.metaText}>
                    Période de la journée : {dayPeriodLabel}
                  </Text>
                </View>
              )}

              {!!fromTime && !!toTime && (
                <View style={styles.metaRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.metaText}>
                    De {String(fromTime).slice(0, 5)} à{" "}
                    {String(toTime).slice(0, 5)}
                  </Text>
                </View>
              )}

              <View style={styles.metaRow}>
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.metaText}>{reason}</Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.metaText}>
                  Soumise le {normalizeDate(createdAt)}
                </Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                testID={`approvals.leaveReject.${requestId}`}
                activeOpacity={0.85}
                onPress={() => rejectLeave(item)}
                disabled={isBusy}
                style={[
                  styles.secondaryButton,
                  isBusy && styles.disabledButton,
                ]}
              >
                {isRejecting ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <>
                    <Ionicons
                      name="close-outline"
                      size={18}
                      color={colors.text}
                    />
                    <Text style={styles.secondaryButtonText}>Rejeter</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID="leave.adminValidateButton"
                activeOpacity={0.85}
                onPress={() => approveLeave(item)}
                disabled={isBusy}
                style={[styles.primaryButton, isBusy && styles.disabledButton]}
              >
                {isApproving ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.textOnPrimary}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-outline"
                      size={18}
                      color={colors.textOnPrimary}
                    />
                    <Text style={styles.primaryButtonText}>Approuver</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Card>
    );
  };

  const renderGeneralRequestCard = (item) => {
    const requestId = getItemId(item);
    const rowKey = `general-${requestId}`;
    const expanded = !!expandedItems[rowKey];

    const action = generalActionState[requestId];
    const isApproving = action === "approving";
    const isRejecting = action === "rejecting";
    const isBusy = !!action;

    const userName =
      item?.userName ?? item?.UserName ?? `Utilisateur #${item?.userId ?? ""}`;
    const title = item?.title ?? item?.Title ?? "Demande générale";
    const description = item?.description ?? item?.Description ?? "";
    const category = item?.category ?? item?.Category;
    const categoryLabel = getGeneralCategoryLabel(category);
    const categoryName = getGeneralCategoryName(category);
    const isRecoveryRequest = categoryName === "Recovery";
    const createdAt = item?.createdAt ?? item?.CreatedAt;
    const recoveryMotif = item?.motif ?? item?.Motif ?? description;
    const recoverySlots = normalizeRecoverySlots(
      item?.recoverySlots ??
        item?.RecoverySlots ??
        item?.recoverySlotsJson ??
        item?.RecoverySlotsJson,
    );
    const explicitTotalRecoveryMinutes = Number(
      item?.totalRecoveryMinutes ?? item?.TotalRecoveryMinutes,
    );
    const calculatedRecoveryMinutes = recoverySlots.reduce((total, slot) => {
      const slotMinutes = getRecoverySlotMinutes(slot);
      return total + (slotMinutes ?? 0);
    }, 0);
    const effectiveTotalRecoveryMinutes =
      !Number.isNaN(explicitTotalRecoveryMinutes) &&
      explicitTotalRecoveryMinutes > 0
        ? explicitTotalRecoveryMinutes
        : calculatedRecoveryMinutes;
    const requiredRecoveryMinutes =
      item?.requiredRecoveryMinutes ?? item?.RequiredRecoveryMinutes;
    const recoveryPermutationType =
      item?.recoveryPermutationType ?? item?.RecoveryPermutationType;
    const recoveryNature = item?.recoveryNature ?? item?.RecoveryNature;
    const effectiveTotalRecoveryDuration = formatDurationMinutes(
      effectiveTotalRecoveryMinutes,
    );
    const requiredRecoveryDuration =
      formatDurationMinutes(requiredRecoveryMinutes);
    const shouldShowRequiredRecoveryDuration =
      !!requiredRecoveryDuration &&
      requiredRecoveryDuration !== effectiveTotalRecoveryDuration;
    const recoverySlotCount = recoverySlots.length;
    const recoverySummaryDuration =
      effectiveTotalRecoveryDuration || "Non renseigné";
    const recoveryPermutationLabel =
      RECOVERY_PERMUTATION_LABELS_FR[recoveryPermutationType] ??
      recoveryPermutationType ??
      "Non renseigné";
    const recoveryNatureLabel =
      RECOVERY_NATURE_LABELS_FR[recoveryNature] ?? recoveryNature;
    const firstRecoverySlot = recoverySlots[0];
    const recoveryCompactPreviewParts = [];

    if (firstRecoverySlot) {
      const firstSlotDate = firstRecoverySlot?.date ?? firstRecoverySlot?.Date;

      if (firstSlotDate) {
        recoveryCompactPreviewParts.push(normalizeDate(firstSlotDate));
      }

      const firstSlotStartTime = formatRecoveryTime(
        firstRecoverySlot?.startTime ?? firstRecoverySlot?.StartTime,
      );
      const firstSlotEndTime = formatRecoveryTime(
        firstRecoverySlot?.endTime ?? firstRecoverySlot?.EndTime,
      );

      if (firstSlotStartTime && firstSlotEndTime) {
        recoveryCompactPreviewParts.push(
          `${firstSlotStartTime} → ${firstSlotEndTime}`,
        );
      }

      const firstSlotDuration = formatDurationMinutes(
        getRecoverySlotMinutes(firstRecoverySlot),
      );

      if (firstSlotDuration) {
        recoveryCompactPreviewParts.push(firstSlotDuration);
      }
    }

    const recoveryCompactPreview =
      recoveryCompactPreviewParts.length > 0
        ? recoveryCompactPreviewParts.join(" · ")
        : recoveryMotif || title;
    const renderRecoveryDetailRow = (icon, label, value) => (
      <View style={styles.recoveryDetailRow}>
        <View style={styles.recoveryDetailIcon}>
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <View style={styles.recoveryDetailContent}>
          <Text style={styles.recoveryDetailLabel}>{label}</Text>
          <Text style={styles.recoveryDetailValue}>{value}</Text>
        </View>
      </View>
    );
    const renderRecoveryDivider = () => <View style={styles.recoveryDivider} />;

    return (
      <Card
        testID={`approvals.generalCard.${requestId}`}
        style={[styles.card, !expanded && styles.compactCard]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => toggleExpanded(rowKey)}
          style={styles.compactRow}
        >
          <View style={styles.avatarWrap}>
            <Ionicons
              name={isRecoveryRequest ? "repeat-outline" : "document-text-outline"}
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.headerTextWrap}>
            <Text style={styles.name}>{categoryLabel}</Text>
            <Text style={styles.email}>{userName}</Text>
            <Text style={styles.smallPreview} numberOfLines={1}>
              {isRecoveryRequest ? recoveryCompactPreview : title}
            </Text>
            {!isRecoveryRequest && (
              <Text style={styles.smallPreview}>{categoryLabel}</Text>
            )}
          </View>

          <View style={styles.rowRight}>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>En attente</Text>
            </View>

            <Ionicons
              name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
              size={22}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.expandedContent}>
            {isRecoveryRequest ? (
              <View style={styles.infoBlock}>
                <View style={styles.recoveryDetailsSection}>
                  {renderRecoveryDetailRow(
                    "swap-horizontal-outline",
                    "Mode de récupération",
                    recoveryPermutationLabel,
                  )}

                  {!!recoveryNatureLabel && (
                    <>
                      {renderRecoveryDetailRow(
                        "briefcase-outline",
                        "Nature du congé",
                        recoveryNatureLabel,
                      )}
                    </>
                  )}

                  {shouldShowRequiredRecoveryDuration && (
                    <>
                      {renderRecoveryDetailRow(
                        "timer-outline",
                        "Durée requise",
                        requiredRecoveryDuration,
                      )}
                    </>
                  )}
                </View>

                {renderRecoveryDivider()}

                <View style={styles.recoverySummarySection}>
                  <Text style={styles.recoverySectionTitle}>Résumé</Text>

                  {renderRecoveryDetailRow(
                    "hourglass-outline",
                    "Total demandé",
                    recoverySummaryDuration,
                  )}

                  {renderRecoveryDetailRow(
                    "calendar-outline",
                    "Nombre de créneaux",
                    String(recoverySlotCount),
                  )}
                </View>

                {renderRecoveryDivider()}

                <View style={styles.recoverySlotsSection}>
                  <Text style={styles.recoverySectionTitle}>
                    {recoverySlots.length === 1
                      ? "Créneau demandé"
                      : "Créneaux demandés"}
                  </Text>

                  {recoverySlots.length > 0 ? (
                    recoverySlots.map((slot, index) => {
                      const slotDate = slot?.date ?? slot?.Date;
                      const startTime = formatRecoveryTime(
                        slot?.startTime ?? slot?.StartTime,
                      );
                      const endTime = formatRecoveryTime(
                        slot?.endTime ?? slot?.EndTime,
                      );
                      const slotDuration = formatDurationMinutes(
                        getRecoverySlotMinutes(slot),
                      );
                      const timeRange =
                        startTime && endTime
                          ? `${startTime} → ${endTime}`
                          : "Horaire non renseigné";

                      return (
                        <View
                          key={`${requestId}-slot-${index}`}
                          style={[
                            styles.recoverySlot,
                            index > 0 && styles.recoverySlotSeparated,
                          ]}
                        >
                          {recoverySlots.length > 1 && (
                            <Text style={styles.recoverySlotTitle}>
                              Créneau {index + 1}
                            </Text>
                          )}

                          <View style={styles.recoverySlotRow}>
                            <Ionicons
                              name="calendar-outline"
                              size={16}
                              color={colors.textSecondary}
                            />
                            <View style={styles.recoverySlotContent}>
                              <Text style={styles.recoverySlotLabel}>Date</Text>
                              <Text style={styles.recoverySlotText}>
                                {normalizeDate(slotDate)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.recoverySlotRow}>
                            <Ionicons
                              name="time-outline"
                              size={16}
                              color={colors.textSecondary}
                            />
                            <View style={styles.recoverySlotContent}>
                              <Text style={styles.recoverySlotLabel}>
                                Horaire
                              </Text>
                              <Text style={styles.recoverySlotText}>
                                {timeRange}
                              </Text>
                            </View>
                          </View>

                          {!!slotDuration && (
                            <View style={styles.recoverySlotRow}>
                              <Ionicons
                                name="hourglass-outline"
                                size={16}
                                color={colors.textSecondary}
                              />
                              <View style={styles.recoverySlotContent}>
                                <Text style={styles.recoverySlotLabel}>
                                  Durée
                                </Text>
                                <Text style={styles.recoverySlotText}>
                                  {slotDuration}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.recoverySlotRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={colors.textSecondary}
                      />
                      <View style={styles.recoverySlotContent}>
                        <Text style={styles.recoverySlotText}>
                          Aucun créneau renseigné
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {renderRecoveryDivider()}

                <View style={styles.recoveryMotifSection}>
                  <View style={styles.recoveryMotifHeader}>
                    <Ionicons
                      name="chatbox-ellipses-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.recoverySectionTitle}>Motif</Text>
                  </View>
                  <Text style={styles.recoveryMotifText}>
                    {recoveryMotif || "Aucun motif fourni"}
                  </Text>
                </View>

                {renderRecoveryDivider()}

                <View style={styles.recoverySubmittedRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.recoverySubmittedText}>
                    Soumise le {normalizeDate(createdAt)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.infoBlock}>
                <View style={styles.metaRow}>
                  <Ionicons
                    name="folder-open-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.metaText}>Type : {categoryLabel}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.metaText}>{title}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons
                    name="chatbox-ellipses-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.metaText}>{description}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.metaText}>
                    Soumise le {normalizeDate(createdAt)}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                testID={`approvals.generalReject.${requestId}`}
                activeOpacity={0.85}
                onPress={() => rejectGeneralRequest(item)}
                disabled={isBusy}
                style={[
                  styles.secondaryButton,
                  isBusy && styles.disabledButton,
                ]}
              >
                {isRejecting ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <>
                    <Ionicons
                      name="close-outline"
                      size={18}
                      color={colors.text}
                    />
                    <Text style={styles.secondaryButtonText}>Rejeter</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID={`approvals.generalApprove.${requestId}`}
                activeOpacity={0.85}
                onPress={() => approveGeneralRequest(item)}
                disabled={isBusy}
                style={[styles.primaryButton, isBusy && styles.disabledButton]}
              >
                {isApproving ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.textOnPrimary}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-outline"
                      size={18}
                      color={colors.textOnPrimary}
                    />
                    <Text style={styles.primaryButtonText}>Approuver</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Card>
    );
  };

  const renderUserCard = (item) => {
    const userId = getUserId(item);
    const rowKey = `user-${userId}`;
    const expanded = !!expandedItems[rowKey];

    const form = formByUserId[userId];
    if (!form) return null;

    const fullName = item?.fullName ?? item?.FullName ?? "Utilisateur inconnu";
    const email = item?.email ?? item?.Email ?? "Aucun e-mail";
    const selectedDepartmentName =
      departments.find((department) => department.value === form.departmentId)
        ?.label ?? null;
    let departmentDisplayName =
      selectedDepartmentName ?? "Département à choisir";

    const createdAt = item?.createdAt ?? item?.CreatedAt;

    const selectedRole = form.role;
    const isAdminSelection = selectedRole === ADMIN_ROLE_ID;
    const roleMeta = getRoleMeta(selectedRole);
    if (isAdminSelection) {
      departmentDisplayName = "Administration globale";
    }

    const action = userActionState[userId];
    const isSubmitting = action === "approving";
    const isRejecting = action === "rejecting";
    const isBusy = !!action;

    return (
      <Card style={[styles.card, !expanded && styles.compactCard]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => toggleExpanded(rowKey)}
          style={styles.compactRow}
        >
          <View style={styles.avatarWrap}>
            <Ionicons name="person-outline" size={22} color={colors.primary} />
          </View>

          <View style={styles.headerTextWrap}>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.email}>{email}</Text>
            <Text style={styles.smallPreview}>{departmentDisplayName}</Text>
          </View>

          <View style={styles.rowRight}>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>En attente</Text>
            </View>

            <Ionicons
              name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
              size={22}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.infoBlock}>
              <View style={styles.metaRow}>
                <Ionicons
                  name="business-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.metaText}>{departmentDisplayName}</Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.metaText}>
                  Inscrit le {normalizeDate(createdAt)}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons
                  name={roleMeta.icon}
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.metaText}>
                  Rôle sélectionné : {roleMeta.label}
                </Text>
              </View>
            </View>

            {!isAdminSelection && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Solde de congés initial</Text>

                <View style={styles.inputWrap}>
                  <Ionicons
                    name="calendar-number-outline"
                    size={18}
                    color={colors.textSecondary}
                  />

                  <TextInput
                    value={String(form.leaveBalance ?? "")}
                    onChangeText={(text) =>
                      updateForm(userId, "leaveBalance", text)
                    }
                    keyboardType="numeric"
                    placeholder="ex. 18"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    editable={!isBusy}
                  />
                </View>
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Salaire annuel</Text>

              <View style={styles.inputWrap}>
                <Ionicons
                  name="cash-outline"
                  size={18}
                  color={colors.textSecondary}
                />

                <TextInput
                  value={String(form.yearlySalary)}
                  onChangeText={(text) =>
                    updateForm(userId, "yearlySalary", text)
                  }
                  keyboardType="numeric"
                  placeholder="ex. 50000"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  editable={!isBusy}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Attribuer un rôle</Text>

              <View style={styles.roleRow}>
                {ROLE_OPTIONS.map((option) =>
                  renderRoleOption(userId, option, selectedRole, isBusy),
                )}
              </View>
            </View>

            {!isAdminSelection && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  Attribuer un département
                </Text>

                {departments.length === 0 ? (
                  <Text style={styles.helperText}>
                    Aucun département disponible.
                  </Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollChips}
                  >
                    {departments.map((dept) =>
                      renderDepartmentOption(
                        userId,
                        dept,
                        form.departmentId,
                        isBusy,
                      ),
                    )}
                  </ScrollView>
                )}
              </View>
            )}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => rejectUser(item)}
                disabled={isBusy}
                style={[
                  styles.secondaryButton,
                  isBusy && styles.disabledButton,
                ]}
              >
                {isRejecting ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <>
                    <Ionicons
                      name="close-outline"
                      size={18}
                      color={colors.text}
                    />
                    <Text style={styles.secondaryButtonText}>Rejeter</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => approveUser(item)}
                disabled={isBusy}
                style={[styles.primaryButton, isBusy && styles.disabledButton]}
              >
                {isSubmitting ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.textOnPrimary}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-outline"
                      size={18}
                      color={colors.textOnPrimary}
                    />
                    <Text style={styles.primaryButtonText}>Approuver</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Card>
    );
  };

  const renderSectionHeader = (title, count, icon) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionIconWrap}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>

        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>
            {count} {count === 1 ? "élément" : "éléments"} en attente
          </Text>
        </View>
      </View>
    </View>
  );

  const renderEmptyCard = (title, text) => (
    <Card style={styles.emptyCard}>
      <Text style={styles.emptyCardTitle}>{title}</Text>
      <Text style={styles.emptyCardText}>{text}</Text>
    </Card>
  );

  const renderFullyEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name="checkmark-done-circle-outline"
          size={58}
          color={colors.primary}
        />
      </View>

      <Text style={styles.emptyTitle}>Aucune approbation en attente</Text>
      <Text style={styles.emptyText}>Tout a déjà été traité.</Text>
    </View>
  );

  const renderTabs = () => {
    const tabs = [
      {
        key: "all",
        label: "Tout",
        count:
          leaveRequests.length + generalRequests.length + pendingUsers.length,
      },
      {
        key: "general",
        label: "Demandes",
        count: leaveRequests.length + generalRequests.length,
      },
      {
        key: "users",
        label: "Utilisateurs",
        count: pendingUsers.length,
      },
    ];

    return (
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              testID={`approvals.tab.${tab.key}`}
              activeOpacity={0.85}
              onPress={() => {
                setActiveTab(tab.key);
                if (tab.key !== "general") {
                  setRequestSubtypeFilter("all");
                }
              }}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>

              <View
                style={[
                  styles.tabCountBadge,
                  isActive && styles.tabCountBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    isActive && styles.tabCountTextActive,
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderRequestSubtypeChips = () => {
    if (activeTab !== "general") {
      return null;
    }

    const countsBySubtype = generalRequests.reduce(
      (acc, item) => {
        const categoryName = getGeneralCategoryName(
          item?.category ?? item?.Category,
        );

        if (categoryName) {
          acc[categoryName] = (acc[categoryName] ?? 0) + 1;
        }

        return acc;
      },
      {
        all: leaveRequests.length + generalRequests.length,
        leave: leaveRequests.length,
      },
    );

    return (
      <ScrollView
        ref={requestSubtypeScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.requestSubtypeContent}
        style={styles.requestSubtypeContainer}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const offset = event.nativeEvent.contentOffset.x;
          const pendingOffset = requestSubtypePendingRestoreOffsetRef.current;

          if (pendingOffset !== null && pendingOffset > 1 && offset <= 1) {
            return;
          }

          requestSubtypeScrollOffsetRef.current = offset;

          if (pendingOffset !== null && Math.abs(offset - pendingOffset) <= 1) {
            requestSubtypePendingRestoreOffsetRef.current = null;
          }
        }}
        onLayout={restoreRequestSubtypeScrollOffset}
      >
        {REQUEST_SUBTYPE_FILTERS.map((filter) => {
          const selected = requestSubtypeFilter === filter.key;
          const count = countsBySubtype[filter.key] ?? 0;

          return (
            <TouchableOpacity
              key={filter.key}
              testID={`approvals.requestType.${filter.key}`}
              activeOpacity={0.85}
              onPress={() => {
                requestSubtypePendingRestoreOffsetRef.current =
                  requestSubtypeScrollOffsetRef.current;
                setRequestSubtypeFilter(filter.key);
              }}
              style={[
                styles.requestSubtypeChip,
                selected && styles.requestSubtypeChipActive,
              ]}
            >
              <Text
                style={[
                  styles.requestSubtypeText,
                  selected && styles.requestSubtypeTextActive,
                ]}
              >
                {filter.label}
              </Text>

              <View
                style={[
                  styles.requestSubtypeCount,
                  selected && styles.requestSubtypeCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.requestSubtypeCountText,
                    selected && styles.requestSubtypeCountTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderListHeader = () => (
    <View>
      {renderTabs()}
      {renderRequestSubtypeChips()}
    </View>
  );

  const listData = useMemo(() => {
    const rows = [];
    const showRequests = activeTab === "all" || activeTab === "general";
    const showLeaveRequests =
      activeTab === "all" ||
      (activeTab === "general" &&
        (requestSubtypeFilter === "all" || requestSubtypeFilter === "leave"));
    const filteredGeneralRequests =
      activeTab === "general" && requestSubtypeFilter !== "all"
        ? generalRequests.filter(
            (item) =>
              getGeneralCategoryName(item?.category ?? item?.Category) ===
              requestSubtypeFilter,
          )
        : generalRequests;

    const noLeaveRequests = leaveRequests.length === 0;
    const noFilteredGeneralRequests = filteredGeneralRequests.length === 0;
    const noPendingUsers = pendingUsers.length === 0;
    const fullyEmpty =
      noLeaveRequests && generalRequests.length === 0 && noPendingUsers;

    if (fullyEmpty) {
      rows.push({
        type: "fullyEmpty",
        key: "fully-empty",
      });

      return rows;
    }

    if (showRequests && showLeaveRequests) {
      rows.push({
        type: "sectionHeader",
        key: "leave-header",
        title: "Demandes de congé",
        count: leaveRequests.length,
        icon: "calendar-clear-outline",
      });

      if (noLeaveRequests) {
        rows.push({
          type: "emptyLeave",
          key: "empty-leave",
        });
      } else {
        leaveRequests.forEach((item) => {
          const id = getItemId(item);

          rows.push({
            type: "leave",
            key: `leave-${id}`,
            item,
          });
        });
      }
    }

    if (
      activeTab === "all" ||
      (activeTab === "general" && requestSubtypeFilter !== "leave")
    ) {
      rows.push({
        type: "sectionHeader",
        key: "general-header",
        title: "Demandes générales",
        count: filteredGeneralRequests.length,
        icon: "document-text-outline",
      });

      if (noFilteredGeneralRequests) {
        rows.push({
          type: "emptyGeneral",
          key: "empty-general",
        });
      } else {
        filteredGeneralRequests.forEach((item) => {
          const id = getItemId(item);

          rows.push({
            type: "general",
            key: `general-${id}`,
            item,
          });
        });
      }
    }

    if (activeTab === "all" || activeTab === "users") {
      rows.push({
        type: "sectionHeader",
        key: "users-header",
        title: "Nouveaux comptes",
        count: pendingUsers.length,
        icon: "person-add-outline",
      });

      if (noPendingUsers) {
        rows.push({
          type: "emptyUsers",
          key: "empty-users",
        });
      } else {
        pendingUsers.forEach((item) => {
          const id = getUserId(item);

          rows.push({
            type: "user",
            key: `user-${id}`,
            item,
          });
        });
      }
    }

    return rows;
  }, [
    activeTab,
    leaveRequests,
    generalRequests,
    pendingUsers,
    requestSubtypeFilter,
  ]);

  const renderItem = ({ item }) => {
    switch (item.type) {
      case "fullyEmpty":
        return renderFullyEmpty();

      case "sectionHeader":
        return renderSectionHeader(item.title, item.count, item.icon);

      case "leave":
        return renderLeaveCard(item.item);

      case "general":
        return renderGeneralRequestCard(item.item);

      case "user":
        return renderUserCard(item.item);

      case "emptyLeave":
        return renderEmptyCard(
          "Aucune demande de congé en attente",
          "Toutes les demandes de congé ont été traitées.",
        );

      case "emptyGeneral":
        return renderEmptyCard(
          "Aucune demande générale en attente",
          "Toutes les demandes générales ont été traitées.",
        );

      case "emptyUsers":
        return renderEmptyCard(
          "Aucune validation de compte en attente",
          "Toutes les demandes de compte ont été traitées.",
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement des approbations...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="lock-closed-outline"
          size={42}
          color={colors.textSecondary}
        />
        <Text style={styles.emptyTitle}>Accès réservé aux admins</Text>
        <Text style={styles.emptyText}>
          Seuls les administrateurs peuvent gérer les demandes.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={listData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={renderListHeader}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl + 112,
    },

    tabsContainer: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: borderRadius.full,
      padding: 4,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },

    tabButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: borderRadius.full,
    },

    tabButtonActive: {
      backgroundColor: colors.primary,
    },

    tabText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      fontWeight: typography.medium,
    },

    tabTextActive: {
      color: colors.textOnPrimary,
      fontWeight: typography.semibold,
    },

    tabCountBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },

    tabCountBadgeActive: {
      backgroundColor: "rgba(255,255,255,0.18)",
    },

    tabCountText: {
      fontSize: 12,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
    },

    tabCountTextActive: {
      color: colors.textOnPrimary,
    },

    requestSubtypeContainer: {
      marginBottom: spacing.lg,
    },

    requestSubtypeContent: {
      gap: spacing.sm,
      paddingRight: spacing.md,
    },

    requestSubtypeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    requestSubtypeChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },

    requestSubtypeText: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.textSecondary,
    },

    requestSubtypeTextActive: {
      color: colors.textOnPrimary,
      fontWeight: typography.semibold,
    },

    requestSubtypeCount: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },

    requestSubtypeCountActive: {
      backgroundColor: "rgba(255,255,255,0.18)",
    },

    requestSubtypeCountText: {
      fontSize: 11,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
    },

    requestSubtypeCountTextActive: {
      color: colors.textOnPrimary,
    },

    sectionHeader: {
      marginBottom: spacing.md,
      marginTop: spacing.sm,
    },

    sectionHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },

    sectionIconWrap: {
      width: 42,
      height: 42,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },

    sectionTitle: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
    },

    sectionSubtitle: {
      marginTop: 2,
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
    },

    card: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: borderRadius.xl || 18,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },

    compactCard: {
      paddingVertical: spacing.md,
    },

    compactRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    expandedContent: {
      marginTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },

    avatarWrap: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },

    headerTextWrap: {
      flex: 1,
    },

    rowRight: {
      alignItems: "flex-end",
      gap: 8,
      marginLeft: spacing.sm,
    },

    pendingBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: borderRadius.full,
      backgroundColor: colors.warningSoft || "#FEF3C7",
    },

    pendingBadgeText: {
      fontSize: 12,
      fontWeight: typography.semibold,
      color: colors.warning || "#B45309",
    },

    name: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },

    email: {
      marginTop: 2,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    smallPreview: {
      marginTop: 3,
      fontSize: 12,
      color: colors.textSecondary,
    },

    infoBlock: {
      marginBottom: spacing.md,
      gap: spacing.sm,
    },

    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    metaText: {
      flex: 1,
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    recoveryDetailsSection: {
      gap: spacing.md,
    },

    recoveryDetailRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },

    recoveryDetailIcon: {
      width: 27,
      height: 27,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },

    recoveryDetailContent: {
      flex: 1,
    },

    recoveryDetailLabel: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
    },

    recoveryDetailValue: {
      marginTop: 2,
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    recoveryDivider: {
      height: 1,
      backgroundColor: colors.border,
    },

    recoverySummarySection: {
      gap: spacing.sm,
    },

    recoverySlotsSection: {
      gap: spacing.sm,
    },

    recoverySectionTitle: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
    },

    recoverySlot: {
      gap: spacing.sm,
      paddingTop: spacing.xs,
    },

    recoverySlotSeparated: {
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    recoverySlotTitle: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.primary,
    },

    recoverySlotRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },

    recoverySlotContent: {
      flex: 1,
    },

    recoverySlotLabel: {
      fontSize: 12,
      fontWeight: typography.medium,
      color: colors.textSecondary,
    },

    recoverySlotText: {
      marginTop: 2,
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
      lineHeight: 20,
    },

    recoveryMotifSection: {
      gap: spacing.xs,
    },

    recoveryMotifHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    recoveryMotifText: {
      fontSize: typography.sm,
      color: colors.text,
      lineHeight: 21,
    },

    recoverySubmittedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    recoverySubmittedText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    section: {
      marginTop: spacing.sm,
    },

    sectionLabel: {
      marginBottom: spacing.sm,
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.text,
    },

    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surfaceMuted || colors.background,
    },

    input: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingLeft: spacing.sm,
      fontSize: typography.sm,
      color: colors.text,
    },

    helperText: {
      marginTop: spacing.xs,
      fontSize: 12,
      color: colors.textSecondary,
    },

    roleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },

    roleChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    roleChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },

    roleChipText: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.text,
    },

    roleChipTextSelected: {
      color: colors.textOnPrimary,
    },

    actionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },

    primaryButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      ...shadows.sm,
    },

    secondaryButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      borderWidth: 1.5,
      borderColor: colors.border,
    },

    primaryButtonText: {
      color: colors.textOnPrimary,
      fontSize: typography.sm,
      fontWeight: typography.semibold,
    },

    secondaryButtonText: {
      color: colors.text,
      fontSize: typography.sm,
      fontWeight: typography.semibold,
    },

    disabledButton: {
      opacity: 0.65,
    },

    disabledChip: {
      opacity: 0.6,
    },

    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },

    loadingText: {
      marginTop: spacing.md,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.xl,
    },

    emptyIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      marginBottom: spacing.md,
      ...shadows.sm,
    },

    emptyTitle: {
      marginTop: spacing.md,
      fontSize: typography.lg,
      fontWeight: typography.semibold,
      color: colors.text,
      textAlign: "center",
    },

    emptyText: {
      marginTop: spacing.xs,
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },

    emptyCard: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: borderRadius.xl || 18,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },

    emptyCardTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: 4,
    },

    emptyCardText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    scrollChips: {
      paddingRight: spacing.md,
      paddingVertical: 4,
    },
  });

export default ApprovalsScreen;
