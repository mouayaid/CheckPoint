import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../components";
import { useTheme } from "../../context/ThemeContext";
import api from "../../services/api/axiosInstance";

const ROLE_OPTIONS = [
  { label: "Employee", value: 1, icon: "person-outline" },
  { label: "Manager", value: 2, icon: "people-outline" },
  { label: "Admin", value: 3, icon: "shield-checkmark-outline" },
];

const DEFAULT_LEAVE_BALANCE = "18";

const AdminUserApprovalsScreen = () => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows]
  );

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [formByUserId, setFormByUserId] = useState({});

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

  const extractArray = (res) => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    return [];
  };

  const loadPendingUsers = async () => {
    try {
      const res = await api.get("/admin/users/pending");
      const data = extractArray(res);

      setUsers(data);

      setFormByUserId((prev) => {
        const next = { ...prev };

        data.forEach((user) => {
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
      console.log("Load pending users error", error);
      Alert.alert("Error", "Could not load pending users.");
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadPendingUsers();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPendingUsers();
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

  const approveUser = async (user) => {
    const userId = getUserId(user);
    const form = formByUserId[userId] || {};
    const rawLeaveBalance = String(form.leaveBalance ?? "").trim();
    const leaveBalance = Number(rawLeaveBalance);

    if (rawLeaveBalance === "" || Number.isNaN(leaveBalance) || leaveBalance < 0) {
      Alert.alert("Validation", "Please enter a valid leave balance.");
      return;
    }

    try {
      setSubmittingId(userId);

      const payload = {
        leaveBalance,
        role: form.role,
      };

      await api.put(`/admin/users/${userId}/approve`, payload);

      Alert.alert("Success", "User approved successfully.");

      setUsers((prev) => prev.filter((u) => getUserId(u) !== userId));
      setFormByUserId((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
    } catch (error) {
      console.log("Approve user error", error);
      Alert.alert("Error", "Could not approve this user.");
    } finally {
      setSubmittingId(null);
    }
  };

  const rejectUser = async (user) => {
    const userId = getUserId(user);

    Alert.alert(
      "Reject user",
      "Are you sure you want to reject this account request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              setRejectingId(userId);

              // Replace this when you add a real backend endpoint
              // await api.put(`/admin/users/${userId}/reject`);

              Alert.alert(
                "Not implemented",
                "User rejection endpoint is not implemented yet."
              );
            } catch (error) {
              console.log("Reject user error", error);
              Alert.alert("Error", "Could not reject this user.");
            } finally {
              setRejectingId(null);
            }
          },
        },
      ]
    );
  };

  const getRoleMeta = (value) => {
    const found = ROLE_OPTIONS.find((r) => r.value === value);
    return found || ROLE_OPTIONS[0];
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

  const renderUserCard = ({ item }) => {
    const userId = getUserId(item);
    const fullName = item?.fullName ?? item?.FullName ?? "Unknown user";
    const email = item?.email ?? item?.Email ?? "No email";
    const departmentName =
      item?.departmentName ?? item?.DepartmentName ?? "No department";
    const role = item?.role ?? item?.Role ?? "Employee";
    const createdAt = item?.createdAt ?? item?.CreatedAt;

    const form = formByUserId[userId] || {
      leaveBalance: DEFAULT_LEAVE_BALANCE,
      role: normalizeRoleValue(role),
    };

    const selectedRole = form.role;
    const roleMeta = getRoleMeta(selectedRole);
    const isSubmitting = submittingId === userId;
    const isRejecting = rejectingId === userId;
    const isBusy = isSubmitting || isRejecting;

    const formattedDate = createdAt
      ? new Date(createdAt).toLocaleDateString()
      : "Unknown date";

    return (
      <Card style={styles.card}>
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
            <Text style={styles.pendingBadgeText}>Pending</Text>
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
            <Text style={styles.metaText}>Registered on {formattedDate}</Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons
              name={roleMeta.icon}
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.metaText}>Selected role: {roleMeta.label}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Initial leave balance</Text>
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
              placeholder="e.g. 18"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              editable={!isBusy}
            />
          </View>
          <Text style={styles.helperText}>
            Set the annual leave balance for this employee.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Assign role</Text>
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
                <Text style={styles.secondaryButtonText}>Reject</Text>
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
                <Text style={styles.primaryButtonText}>Approve user</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          Loading pending account approvals...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {users.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="checkmark-circle-outline"
              size={56}
              color={colors.success || colors.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>No pending account approvals</Text>
          <Text style={styles.emptyText}>
            All pending users have been reviewed.
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(getUserId(item))}
          renderItem={renderUserCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
};

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    listContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },

    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      backgroundColor: colors.background,
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

    loadingText: {
      marginTop: spacing.md,
      fontSize: typography.sm,
      color: colors.textSecondary,
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
  });

export default AdminUserApprovalsScreen;