import React, { useCallback, useMemo, useState } from "react";
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

const DEFAULT_LEAVE_BALANCE = "18";
const DEFAULT_YEARLY_SALARY = "50000";

const ApprovalsScreen = () => {
  const route = useRoute();

  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const [activeTab, setActiveTab] = useState("all");
  useFocusEffect(
    useCallback(() => {
      if (route.params?.filter === "leaves") {
        setActiveTab("leave");
      } else if (route.params?.filter === "users") {
        setActiveTab("users");
      }
    }, [route.params?.filter]),
  );
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [leaveActionState, setLeaveActionState] = useState({});
  const [userActionState, setUserActionState] = useState({});
  const [formByUserId, setFormByUserId] = useState({});

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
    return d.toLocaleDateString();
  };

  const normalizeDateRange = (start, end) => {
    return `${normalizeDate(start)} → ${normalizeDate(end)}`;
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

  const loadApprovals = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [leaveRes, usersRes, depsRes] = await Promise.allSettled([
        api.get("/Leave/pending-review"),
        api.get("/admin/users/pending"),
        api.get("/Departments"),
      ]);

      let leaveData = [];
      let usersData = [];
      let depsData = [];

      if (leaveRes.status === "fulfilled") {
        leaveData = extractArray(leaveRes.value);
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
              role: normalizeRoleValue(user?.role ?? user?.Role),
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
      setPendingUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadApprovals();
    }, [loadApprovals]),
  );

  const onRefresh = useCallback(async () => {
    await loadApprovals(true);
  }, [loadApprovals]);

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

  const approveLeave = async (item) => {
    const requestId = getItemId(item);

    try {
      setLeaveAction(requestId, "approving");

      await api.put(`/Leave/requests/${requestId}/approve`, {
        comment: "Approved by HR/Admin",
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
        comment: "Rejected by HR/Admin",
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

    const rawLeaveBalance = String(form.leaveBalance ?? "").trim();
    const leaveBalance = Number(rawLeaveBalance);

    if (
      rawLeaveBalance === "" ||
      Number.isNaN(leaveBalance) ||
      leaveBalance < 0
    ) {
      Alert.alert("Validation", "Veuillez saisir un solde de congés valide.");
      return;
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

    if (!form.departmentId) {
      Alert.alert("Validation", "Veuillez sélectionner un département.");
      return;
    }

    try {
      setUserAction(userId, "approving");

      await api.put(`/admin/users/${userId}/approve`, {
        leaveBalance,
        yearlySalary,
        roleId: form.role,
        departmentId: form.departmentId,
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
                reason: "Rejeté par RH/Admin",
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
        onPress={() => updateForm(userId, "role", option.value)}
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

    const leaveType = item?.type ?? item?.leaveType ?? item?.Type ?? "Congé";
    const reason = item?.reason ?? item?.Reason ?? "Aucun motif fourni";
    const createdAt = item?.createdAt ?? item?.CreatedAt;

    return (
      <Card style={[styles.card, !expanded && styles.compactCard]}>
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
            <Text style={styles.name}>Demande de congé</Text>
            <Text style={styles.email}>{userName}</Text>
            <Text style={styles.smallPreview}>
              {normalizeDateRange(item?.startDate, item?.endDate)}
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
                <Text style={styles.metaText}>Type : {leaveType}</Text>
              </View>

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

  const renderUserCard = (item) => {
    const userId = getUserId(item);
    const rowKey = `user-${userId}`;
    const expanded = !!expandedItems[rowKey];

    const form = formByUserId[userId];
    if (!form) return null;

    const fullName = item?.fullName ?? item?.FullName ?? "Utilisateur inconnu";
    const email = item?.email ?? item?.Email ?? "Aucun e-mail";
    const departmentName =
      item?.departmentName ?? item?.DepartmentName ?? "Aucun département";

    const createdAt = item?.createdAt ?? item?.CreatedAt;

    const selectedRole = form.role;
    const roleMeta = getRoleMeta(selectedRole);

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
            <Text style={styles.smallPreview}>{departmentName}</Text>
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
                <Text style={styles.metaText}>{departmentName}</Text>
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

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Solde de congés initial</Text>

              <View style={styles.inputWrap}>
                <Ionicons
                  name="calendar-number-outline"
                  size={18}
                  color={colors.textSecondary}
                />

                <TextInput
                  value={String(form.leaveBalance)}
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

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Attribuer un département</Text>

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
        count: leaveRequests.length + pendingUsers.length,
      },
      {
        key: "leave",
        label: "Congés",
        count: leaveRequests.length,
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
              activeOpacity={0.85}
              onPress={() => setActiveTab(tab.key)}
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

  const listData = useMemo(() => {
    const rows = [];

    const noLeaveRequests = leaveRequests.length === 0;
    const noPendingUsers = pendingUsers.length === 0;
    const fullyEmpty = noLeaveRequests && noPendingUsers;

    if (fullyEmpty) {
      rows.push({
        type: "fullyEmpty",
        key: "fully-empty",
      });

      return rows;
    }

    if (activeTab === "all" || activeTab === "leave") {
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
  }, [activeTab, leaveRequests, pendingUsers]);

  const renderItem = ({ item }) => {
    switch (item.type) {
      case "fullyEmpty":
        return renderFullyEmpty();

      case "sectionHeader":
        return renderSectionHeader(item.title, item.count, item.icon);

      case "leave":
        return renderLeaveCard(item.item);

      case "user":
        return renderUserCard(item.item);

      case "emptyLeave":
        return renderEmptyCard(
          "Aucune demande de congé en attente",
          "Toutes les demandes de congé ont été traitées.",
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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={listData}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      ListHeaderComponent={renderTabs}
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
      paddingBottom: spacing.xxl,
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
