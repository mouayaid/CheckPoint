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
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../components";
import { useTheme } from "../../context/ThemeContext";
import api from "../../services/api/axiosInstance";

const ROLE_OPTIONS = [
  { label: "Employé", value: 1, icon: "person-outline" },
  { label: "Manager", value: 2, icon: "people-outline" },
  { label: "Admin", value: 3, icon: "shield-checkmark-outline" },
];

const DEFAULT_LEAVE_BALANCE = "18";

const ApprovalsScreen = () => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows]
  );

  const [activeTab, setActiveTab] = useState("all");

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [actionLoadingKey, setActionLoadingKey] = useState(null);
  const [submittingUserId, setSubmittingUserId] = useState(null);
  const [rejectingUserId, setRejectingUserId] = useState(null);

  const [formByUserId, setFormByUserId] = useState({});

  const normalizeDate = (value) => {
    if (!value) return "Date inconnue";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString();
  };

  const normalizeDateRange = (start, end) => {
    const startDate = normalizeDate(start);
    const endDate = normalizeDate(end);
    return `${startDate} → ${endDate}`;
  };

  const extractArray = (res) => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    return [];
  };

  const getUserId = (item) => item?.id ?? item?.Id;

  const normalizeRoleValue = (role) => {
    if (typeof role === "number") return role;

    if (typeof role === "string") {
      const lowered = role.trim().toLowerCase();
      if (lowered === "employee" || lowered === "user") return 1;
      if (lowered === "manager") return 2;
      if (lowered === "admin") return 3;
    }

    return 1;
  };

  const getRoleMeta = (value) => {
    const found = ROLE_OPTIONS.find((r) => r.value === value);
    return found || ROLE_OPTIONS[0];
  };

  const loadApprovals = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [leaveRes, usersRes] = await Promise.allSettled([
        api.get("/Leave/pending-review"),
        api.get("/admin/users/pending"),
      ]);

      let leaveData = [];
      let usersData = [];

      if (leaveRes.status === "fulfilled") {
        leaveData = extractArray(leaveRes.value);
      }

      if (usersRes.status === "fulfilled") {
        usersData = extractArray(usersRes.value);
      }

      setLeaveRequests(leaveData);
      setPendingUsers(usersData);

      setFormByUserId((prev) => {
        const next = { ...prev };

        usersData.forEach((user) => {
          const userId = getUserId(user);

          if (!next[userId]) {
            next[userId] = {
              leaveBalance: DEFAULT_LEAVE_BALANCE,
              role: normalizeRoleValue(user?.role ?? user?.Role),
            };
          }
        });

        return next;
      });
    } catch (error) {
      Alert.alert("Erreur", "Impossible de charger les approbations.");
      setLeaveRequests([]);
      setPendingUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadApprovals();
    }, [])
  );

  const onRefresh = async () => {
    await loadApprovals(true);
  };

  const updateForm = (userId, field, value) => {
    setFormByUserId((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  };

  const approveLeave = async (item) => {
    const requestId = item?.id ?? item?.Id;
    const key = `leave-${requestId}`;

    try {
      setActionLoadingKey(key);

      await api.put(`/Leave/requests/${requestId}/approve`, {
        comment: "Approved by HR/Admin",
      });

      await loadApprovals();
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'approuver la demande de congé.");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const rejectLeave = async (item) => {
    const requestId = item?.id ?? item?.Id;
    const key = `leave-${requestId}`;

    try {
      setActionLoadingKey(key);

      await api.put(`/Leave/requests/${requestId}/reject`, {
        comment: "Rejected by HR/Admin",
      });

      await loadApprovals();
    } catch (error) {
      Alert.alert("Erreur", "Impossible de rejeter la demande de congé.");
    } finally {
      setActionLoadingKey(null);
    }
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

    try {
      setSubmittingUserId(userId);

      await api.put(`/admin/users/${userId}/approve`, {
        leaveBalance,
        role: form.role,
      });

      await loadApprovals();
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'approuver cet utilisateur.");
    } finally {
      setSubmittingUserId(null);
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
              setRejectingUserId(userId);

              await api.put(`/admin/users/${userId}/reject`, {
                reason: "Rejeté par RH/Admin",
              });

              await loadApprovals();
            } catch (error) {
              Alert.alert("Erreur", "Impossible de rejeter cet utilisateur.");
            } finally {
              setRejectingUserId(null);
            }
          },
        },
      ]
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

  const renderLeaveCard = (item) => {
    const requestId = item?.id ?? item?.Id;
    const key = `leave-${requestId}`;
    const isBusy = actionLoadingKey === key;

    const userName =
      item?.userName ?? item?.UserName ?? `Utilisateur #${item?.userId ?? ""}`;
    const leaveType = item?.type ?? item?.leaveType ?? item?.Type ?? "Congé";
    const reason = item?.reason ?? item?.Reason ?? "Aucun motif fourni";
    const createdAt = item?.createdAt ?? item?.CreatedAt;

    return (
      <Card key={key} style={styles.card}>
        <View style={styles.cardTop}>
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
          </View>

          <View style={styles.pendingBadge}>
            <Ionicons
              name="time-outline"
              size={13}
              color={colors.warning || "#D97706"}
            />
            <Text style={styles.pendingBadgeText}>En attente</Text>
          </View>
        </View>

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
            <Text style={styles.metaText}>Soumise le {normalizeDate(createdAt)}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => rejectLeave(item)}
            disabled={isBusy}
            style={[styles.secondaryButton, isBusy && styles.disabledButton]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <>
                <Ionicons name="close-outline" size={18} color={colors.text} />
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
            {isBusy ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
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
      </Card>
    );
  };

  const renderUserCard = (item) => {
    const userId = getUserId(item);
    const fullName = item?.fullName ?? item?.FullName ?? "Utilisateur inconnu";
    const email = item?.email ?? item?.Email ?? "Aucun e-mail";
    const departmentName =
      item?.departmentName ?? item?.DepartmentName ?? "Aucun département";
    const role = item?.role ?? item?.Role ?? "Employee";
    const createdAt = item?.createdAt ?? item?.CreatedAt;

    const form = formByUserId[userId] || {
      leaveBalance: DEFAULT_LEAVE_BALANCE,
      role: normalizeRoleValue(role),
    };

    const selectedRole = form.role;
    const roleMeta = getRoleMeta(selectedRole);
    const isSubmitting = submittingUserId === userId;
    const isRejecting = rejectingUserId === userId;
    const isBusy = isSubmitting || isRejecting;

    return (
      <Card key={`user-${userId}`} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person-outline" size={22} color={colors.primary} />
          </View>

          <View style={styles.headerTextWrap}>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.email}>{email}</Text>
          </View>

          <View style={styles.pendingBadge}>
            <Ionicons
              name="time-outline"
              size={13}
              color={colors.warning || "#D97706"}
            />
            <Text style={styles.pendingBadgeText}>En attente</Text>
          </View>
        </View>

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
            <Text style={styles.metaText}>Inscrit le {normalizeDate(createdAt)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons
              name={roleMeta.icon}
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.metaText}>Rôle sélectionné : {roleMeta.label}</Text>
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
              onChangeText={(text) => updateForm(userId, "leaveBalance", text)}
              keyboardType="numeric"
              placeholder="ex. 18"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              editable={!isBusy}
            />
          </View>
          <Text style={styles.helperText}>
            Définissez le solde annuel de congés pour cet employé.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Attribuer un rôle</Text>
          <View style={styles.roleRow}>
            {ROLE_OPTIONS.map((option) =>
              renderRoleOption(userId, option, selectedRole, isBusy)
            )}
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => rejectUser(item)}
            disabled={isBusy}
            style={[styles.secondaryButton, isBusy && styles.disabledButton]}
          >
            {isRejecting ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <>
                <Ionicons name="close-outline" size={18} color={colors.text} />
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
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-outline"
                  size={18}
                  color={colors.textOnPrimary}
                />
                <Text style={styles.primaryButtonText}>Approuver l'utilisateur</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
            {count} en attente {count === 1 ? "élément" : "éléments"}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderTabs = () => {
    const tabs = [
      { key: "all", label: "Tout", count: leaveRequests.length + pendingUsers.length },
      { key: "leave", label: "Congés", count: leaveRequests.length },
      { key: "users", label: "Utilisateurs", count: pendingUsers.length },
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement des approbations...</Text>
      </View>
    );
  }

  const noLeaveRequests = leaveRequests.length === 0;
  const noPendingUsers = pendingUsers.length === 0;
  const fullyEmpty = noLeaveRequests && noPendingUsers;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {renderTabs()}

      {fullyEmpty ? (
        <View style={styles.centered}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={58}
              color={colors.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>Aucune approbation en attente</Text>
          <Text style={styles.emptyText}>
            Tout a déjà été traité.
          </Text>
        </View>
      ) : (
        <>
          {(activeTab === "all" || activeTab === "leave") && (
            <View style={styles.block}>
              {renderSectionHeader(
                "Demandes de congé",
                leaveRequests.length,
                "calendar-clear-outline"
              )}

              {noLeaveRequests ? (
                <Card style={styles.emptyCard}>
                  <Text style={styles.emptyCardTitle}>
                    Aucune demande de congé en attente
                  </Text>
                  <Text style={styles.emptyCardText}>
                    Toutes les demandes de congé ont été traitées.
                  </Text>
                </Card>
              ) : (
                leaveRequests.map(renderLeaveCard)
              )}
            </View>
          )}

          {(activeTab === "all" || activeTab === "users") && (
            <View style={styles.block}>
              {renderSectionHeader(
                "Nouveaux comptes",
                pendingUsers.length,
                "person-add-outline"
              )}

              {noPendingUsers ? (
                <Card style={styles.emptyCard}>
                  <Text style={styles.emptyCardTitle}>
                    Aucune validation de compte en attente
                  </Text>
                  <Text style={styles.emptyCardText}>
                    Toutes les demandes de compte ont été traitées.
                  </Text>
                </Card>
              ) : (
                pendingUsers.map(renderUserCard)
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
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

    block: {
      marginBottom: spacing.xl,
    },

    sectionHeader: {
      marginBottom: spacing.md,
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
      marginBottom: spacing.lg,
      borderRadius: borderRadius.xl || 18,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },

    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
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

    pendingBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
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
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.background,
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
      borderWidth: 1,
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
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
    },

    secondaryButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      borderWidth: 1,
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
      backgroundColor: colors.background,
    },

    loadingText: {
      marginTop: spacing.md,
      fontSize: typography.sm,
      color: colors.textSecondary,
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
  });

export default ApprovalsScreen;