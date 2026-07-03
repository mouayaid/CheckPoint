import logger from "../../utils/logger";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { adminUserService } from "../../services/api/adminUserService";

const ROLE_ICONS = {
  employee: "person-outline",
  employé: "person-outline",
  employe: "person-outline",
  user: "person-outline",
  manager: "people-outline",
  admin: "shield-checkmark-outline",
};

const ROLE_COLORS = ["#3B82F6", "#8B5CF6", "#E11D48", "#F59E0B", "#10B981"];

const ALLOWED_ROLE_NAMES = new Set([
  "employee",
  "employé",
  "employe",
  "user",
  "manager",
  "admin",
]);

const extractArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
};

const normalizeBackendItems = (items) =>
  items
    .filter((x) =>
      ALLOWED_ROLE_NAMES.has(
        String(x.name ?? x.Name ?? x.label ?? x.Label ?? "").toLowerCase(),
      ),
    )
    .map((x, index) => ({
      value: x.id ?? x.Id ?? x.value ?? x.Value,
      label: x.name ?? x.Name ?? x.label ?? x.Label,
      icon:
        ROLE_ICONS[String(x.name ?? x.Name ?? "").toLowerCase()] ??
        "person-outline",
      color: ROLE_COLORS[index % ROLE_COLORS.length],
    }));

const normalizeDepartments = (items) =>
  items.map((x) => ({
    value: x.id ?? x.Id ?? x.value ?? x.Value,
    label: x.name ?? x.Name ?? x.label ?? x.Label ?? "Département",
  }));

const normalizeRole = (r, roles) => {
  if (typeof r === "number") {
    return roles.some((role) => role.value === r) ? r : (roles[0]?.value ?? 1);
  }

  if (typeof r === "string") {
    const normalized = r.trim().toLowerCase();

    const found = roles.find((role) => {
      const label = String(role.label ?? "")
        .trim()
        .toLowerCase();

      return (
        label === normalized ||
        (normalized === "employee" &&
          ["employé", "employe", "user"].includes(label)) ||
        (normalized === "employé" &&
          ["employee", "employe", "user"].includes(label)) ||
        (normalized === "employe" &&
          ["employee", "employé", "user"].includes(label)) ||
        (normalized === "user" &&
          ["employee", "employé", "employe"].includes(label)) ||
        (normalized === "manager" && label === "manager") ||
        (normalized === "admin" && label === "admin")
      );
    });

    return found?.value ?? null;
  }

  return null;
};

const getRoleValueFromUser = (user, roles) =>
  normalizeRole(
    user?.roleId ??
      user?.RoleId ??
      user?.role ??
      user?.Role ??
      user?.roleName ??
      user?.RoleName,
    roles,
  );

const isAdminRoleValue = (roleValue, roles) => {
  const role = roles.find((item) => item.value === roleValue);
  return String(role?.label ?? "").trim().toLowerCase() === "admin";
};

const getDepartmentDisplayName = (user, roleValue, roles) =>
  isAdminRoleValue(roleValue, roles)
    ? "Administration globale"
    : (user?.departmentName ?? user?.DepartmentName ?? "—");

const fmt = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? String(d)
    : dt.toLocaleDateString("fr-FR");
};

const initials = (name) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

const SectionHeader = ({ label, colors, spacing, typography }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    }}
  >
    <Text
      style={{
        fontSize: typography.xs,
        fontWeight: typography.semibold,
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.8,
      }}
    >
      {label}
    </Text>
    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
  </View>
);

const EditModal = ({
  visible,
  user,
  roles,
  departments,
  onClose,
  onSave,
  colors,
  spacing,
  typography,
  borderRadius,
}) => {
  const [fullName, setFullName] = useState("");
  const [leaveBalance, setLeaveBalance] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  React.useEffect(() => {
    if (user) {
      setFullName(user.fullName ?? user.FullName ?? "");
      setLeaveBalance(String(user.leaveBalance ?? user.LeaveBalance ?? ""));
      const roleValue = getRoleValueFromUser(user, roles);
      setSelectedRole(roleValue);
      setSelectedDepartment(
        isAdminRoleValue(roleValue, roles)
          ? null
          : (user.departmentId ?? user.DepartmentId ?? departments[0]?.value ?? 1),
      );
    }
  }, [user, roles, departments]);

  const handleSave = async () => {
    const isAdmin = isAdminRoleValue(selectedRole, roles);
    if (!fullName.trim()) {
      Alert.alert("Validation", "Le nom complet est obligatoire.");
      return;
    }

    const lb = Number(leaveBalance);

    if (Number.isNaN(lb) || lb < 0) {
      Alert.alert("Validation", "Solde de congés invalide.");
      return;
    }

    if (!selectedRole || (!isAdmin && !selectedDepartment)) {
      Alert.alert("Validation", "Veuillez choisir un rôle et un département.");
      return;
    }

    setSaving(true);

    try {
      await onSave(user.id ?? user.Id, {
        fullName: fullName.trim(),
        roleId: selectedRole,
        departmentId: isAdmin ? null : selectedDepartment,
        leaveBalance: lb,
      });

      onClose();
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour l'utilisateur.");
    } finally {
      setSaving(false);
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "flex-end",
        },
        backdrop: { flex: 1 },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: 36,
          maxHeight: "94%",
        },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: "center",
          marginBottom: spacing.md,
        },
        titleRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.xs,
        },
        title: {
          fontSize: typography.xl,
          fontWeight: typography.bold,
          color: colors.text,
        },
        closeBtn: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        },
        fieldLabel: {
          fontSize: typography.xs,
          fontWeight: typography.semibold,
          color: colors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: 0.7,
          marginBottom: 6,
        },
        input: {
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: 14,
          paddingVertical: 13,
          fontSize: typography.base,
          color: colors.text,
        },
        inputFocused: {
          borderColor: colors.primary,
          backgroundColor: `${colors.primary}08`,
        },
        row2: {
          flexDirection: "row",
          gap: 12,
          marginTop: spacing.sm,
        },
        halfField: { flex: 1 },
        chipGrid: {
          flexDirection: "row",
          gap: 8,
          flexWrap: "wrap",
          marginTop: spacing.xs,
        },
        chip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: borderRadius.full,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
        },
        chipSel: {
          borderColor: colors.primary,
          backgroundColor: `${colors.primary}14`,
        },
        chipTxt: {
          fontSize: typography.sm,
          color: colors.textSecondary,
          fontWeight: typography.medium,
        },
        chipTxtSel: {
          color: colors.primary,
          fontWeight: typography.semibold,
        },
        footer: {
          flexDirection: "row",
          gap: 10,
          paddingTop: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          marginTop: spacing.lg,
        },
        cancelBtn: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          borderRadius: borderRadius.lg,
          borderWidth: 1.5,
          borderColor: colors.border,
        },
        cancelTxt: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.textSecondary,
        },
        saveBtn: {
          flex: 2,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.primary,
        },
        saveTxt: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: "#fff",
        },
      }),
    [colors, spacing, typography, borderRadius],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.overlay}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={s.sheet}>
          <View style={s.handle} />

          <View style={s.titleRow}>
            <Text style={s.title}>Modifier l'utilisateur</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <SectionHeader
              label="Identité"
              colors={colors}
              spacing={spacing}
              typography={typography}
            />

            <Text style={s.fieldLabel}>Nom complet</Text>
            <TextInput
              style={[s.input, focusedField === "name" && s.inputFocused]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nom complet"
              placeholderTextColor={colors.placeholder}
              editable={!saving}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
            />

            <SectionHeader
              label="Congés"
              colors={colors}
              spacing={spacing}
              typography={typography}
            />

            <View style={s.row2}>
              <View style={s.halfField}>
                <Text style={s.fieldLabel}>Solde (jours)</Text>
                <TextInput
                  style={[s.input, focusedField === "leave" && s.inputFocused]}
                  value={leaveBalance}
                  onChangeText={setLeaveBalance}
                  keyboardType="numeric"
                  placeholder="ex. 18"
                  placeholderTextColor={colors.placeholder}
                  editable={!saving}
                  onFocus={() => setFocusedField("leave")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {!isAdminRoleValue(selectedRole, roles) && (
              <>
            <SectionHeader
              label="Département"
              colors={colors}
              spacing={spacing}
              typography={typography}
            />

            <View style={s.chipGrid}>
              {departments.map((dep) => {
                const sel = selectedDepartment === dep.value;

                return (
                  <TouchableOpacity
                    key={dep.value}
                    style={[s.chip, sel && s.chipSel]}
                    onPress={() => setSelectedDepartment(dep.value)}
                    disabled={saving}
                  >
                    <Ionicons
                      name="business-outline"
                      size={13}
                      color={sel ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[s.chipTxt, sel && s.chipTxtSel]}>
                      {dep.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

              </>
            )}

            <SectionHeader
              label="Rôle"
              colors={colors}
              spacing={spacing}
              typography={typography}
            />

            <View style={s.chipGrid}>
              {roles.map((role) => {
                const sel = selectedRole === role.value;

                return (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      s.chip,
                      sel && {
                        borderColor: role.color,
                        backgroundColor: `${role.color}14`,
                      },
                    ]}
                    onPress={() => {
                      setSelectedRole(role.value);
                      if (isAdminRoleValue(role.value, roles)) {
                        setSelectedDepartment(null);
                      } else if (!selectedDepartment) {
                        setSelectedDepartment(departments[0]?.value ?? null);
                      }
                    }}
                    disabled={saving}
                  >
                    <Ionicons
                      name={role.icon}
                      size={13}
                      color={sel ? role.color : colors.textSecondary}
                    />
                    <Text
                      style={[
                        s.chipTxt,
                        sel && {
                          color: role.color,
                          fontWeight: typography.semibold,
                        },
                      ]}
                    >
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.footer}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={onClose}
                disabled={saving}
              >
                <Text style={s.cancelTxt}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.saveBtn}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.saveTxt}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const DeactivateUserModal = ({
  visible,
  user,
  submitting,
  onCancel,
  onConfirm,
  colors,
  spacing,
  typography,
  borderRadius,
}) => {
  const name = user?.fullName ?? user?.FullName ?? "Utilisateur";
  const email = user?.email ?? user?.Email ?? "Aucun e-mail";

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "flex-end",
        },
        backdrop: {
          flex: 1,
        },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: 36,
        },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: "center",
          marginBottom: spacing.lg,
        },
        warningIcon: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(239,68,68,0.12)",
          marginBottom: spacing.md,
        },
        title: {
          fontSize: typography.xl,
          fontWeight: typography.bold,
          color: colors.text,
          marginBottom: spacing.sm,
        },
        message: {
          fontSize: typography.sm,
          color: colors.textSecondary,
          lineHeight: 20,
          marginBottom: spacing.lg,
        },
        summaryCard: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
          marginBottom: spacing.lg,
        },
        summaryAvatar: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(239,68,68,0.12)",
        },
        summaryName: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.text,
        },
        summaryEmail: {
          marginTop: 2,
          fontSize: typography.xs,
          color: colors.textSecondary,
        },
        footer: {
          flexDirection: "row",
          gap: 10,
        },
        cancelBtn: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          borderRadius: borderRadius.lg,
          borderWidth: 1.5,
          borderColor: colors.border,
        },
        cancelTxt: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.textSecondary,
        },
        deactivateBtn: {
          flex: 1.4,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          borderRadius: borderRadius.lg,
          backgroundColor: "#EF4444",
        },
        disabledBtn: {
          opacity: 0.65,
        },
        deactivateTxt: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: "#fff",
        },
      }),
    [colors, spacing, typography, borderRadius],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={submitting ? undefined : onCancel}
        />

        <View style={s.sheet}>
          <View style={s.handle} />

          <View style={s.warningIcon}>
            <Ionicons name="warning-outline" size={28} color="#EF4444" />
          </View>

          <Text style={s.title}>Désactiver le compte</Text>
          <Text style={s.message}>
            Cet utilisateur ne pourra plus se connecter, mais son historique
            sera conservé.
          </Text>

          <View style={s.summaryCard}>
            <View style={s.summaryAvatar}>
              <Ionicons name="person-outline" size={20} color="#EF4444" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={s.summaryName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={s.summaryEmail} numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>

          <View style={s.footer}>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={onCancel}
              disabled={submitting}
            >
              <Text style={s.cancelTxt}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.deactivateBtn, submitting && s.disabledBtn]}
              onPress={onConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.deactivateTxt}>Désactiver</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ReactivateUserModal = ({
  visible,
  user,
  submitting,
  onCancel,
  onConfirm,
  colors,
  spacing,
  typography,
  borderRadius,
}) => {
  const name = user?.fullName ?? user?.FullName ?? "Utilisateur";
  const email = user?.email ?? user?.Email ?? "Aucun e-mail";

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "flex-end",
        },
        backdrop: { flex: 1 },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: 36,
        },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: "center",
          marginBottom: spacing.lg,
        },
        icon: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${colors.primary}14`,
          marginBottom: spacing.md,
        },
        title: {
          fontSize: typography.xl,
          fontWeight: typography.bold,
          color: colors.text,
          marginBottom: spacing.sm,
        },
        message: {
          fontSize: typography.sm,
          color: colors.textSecondary,
          lineHeight: 20,
          marginBottom: spacing.lg,
        },
        summaryCard: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
          marginBottom: spacing.lg,
        },
        summaryAvatar: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${colors.primary}14`,
        },
        summaryName: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.text,
        },
        summaryEmail: {
          marginTop: 2,
          fontSize: typography.xs,
          color: colors.textSecondary,
        },
        footer: { flexDirection: "row", gap: 10 },
        cancelBtn: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          borderRadius: borderRadius.lg,
          borderWidth: 1.5,
          borderColor: colors.border,
        },
        cancelTxt: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.textSecondary,
        },
        reactivateBtn: {
          flex: 1.4,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.primary,
        },
        disabledBtn: { opacity: 0.65 },
        reactivateTxt: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: "#fff",
        },
      }),
    [colors, spacing, typography, borderRadius],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={submitting ? undefined : onCancel}
        />

        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.icon}>
            <Ionicons
              name="refresh-circle-outline"
              size={32}
              color={colors.primary}
            />
          </View>

          <Text style={s.title}>Réactiver le compte</Text>
          <Text style={s.message}>
            Cet utilisateur pourra à nouveau se connecter à son compte.
          </Text>

          <View style={s.summaryCard}>
            <View style={s.summaryAvatar}>
              <Ionicons
                name="person-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.summaryName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={s.summaryEmail} numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>

          <View style={s.footer}>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={onCancel}
              disabled={submitting}
            >
              <Text style={s.cancelTxt}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.reactivateBtn, submitting && s.disabledBtn]}
              onPress={onConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.reactivateTxt}>Réactiver</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const UserCard = ({
  user,
  roles,
  deactivatingId,
  reactivatingId,
  statusFilter,
  onEdit,
  onDeactivate,
  onReactivate,
  colors,
  styles,
  typography,
}) => {
  const id = user.id ?? user.Id;
  const name = user.fullName ?? user.FullName ?? "—";
  const email = user.email ?? user.Email ?? "—";
  const isActive = user.isActive ?? user.IsActive ?? false;

  const role = getRoleValueFromUser(user, roles);
  const deptDisplay = getDepartmentDisplayName(user, role, roles);
  const roleMeta = roles.find((r) => r.value === role) ??
    roles[0] ?? { icon: "person-outline", color: colors.primary, label: "—" };

  const isDeactivating = deactivatingId === id;
  const isReactivating = reactivatingId === id;
  const isInactiveMode = statusFilter === "inactive";
  const isActionBusy = isInactiveMode ? isReactivating : isDeactivating;
  const userInitials = initials(name);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          style={[styles.avatar, { backgroundColor: `${roleMeta.color}20` }]}
        >
          {userInitials ? (
            <Text style={[styles.avatarText, { color: roleMeta.color }]}>
              {userInitials}
            </Text>
          ) : (
            <Ionicons name={roleMeta.icon} size={20} color={roleMeta.color} />
          )}
        </View>

        <View style={styles.cardHeaderText}>
          <Text style={styles.userName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {email}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isActive ? "#D1FAE5" : "#FEE2E2" },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isActive ? "#10B981" : "#EF4444" },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isActive ? "#065F46" : "#991B1B" },
            ]}
          >
            {isActive ? "Actif" : "Inactif"}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <View
            style={[
              styles.metaIconWrap,
              { backgroundColor: `${roleMeta.color}14` },
            ]}
          >
            <Ionicons name={roleMeta.icon} size={12} color={roleMeta.color} />
          </View>
          <Text
            style={[
              styles.metaText,
              { color: roleMeta.color, fontWeight: typography.semibold },
            ]}
          >
            {roleMeta.label}
          </Text>
        </View>

        <View style={styles.metaDot} />

        <View style={styles.metaItem}>
          <Ionicons
            name="business-outline"
            size={12}
            color={colors.textSecondary}
          />
          <Text style={styles.metaText} numberOfLines={1}>
            {deptDisplay}
          </Text>
        </View>

        <View style={styles.metaDot} />

        <View style={styles.metaItem}>
          <Ionicons
            name="leaf-outline"
            size={12}
            color={colors.textSecondary}
          />
          <Text style={styles.metaText}>
            {user.leaveBalance ?? user.LeaveBalance ?? "—"} j
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>
          <Ionicons
            name="time-outline"
            size={11}
            color={colors.textSecondary}
          />
          {"  "}
          {fmt(user.createdAt ?? user.CreatedAt)}
        </Text>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => onEdit(user)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="create-outline" size={15} color={colors.primary} />
            <Text style={[styles.actionBtnTxt, { color: colors.primary }]}>
              Modifier
            </Text>
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity
            style={[
              isInactiveMode ? styles.reactivateBtn : styles.deleteBtn,
              isActionBusy && styles.disabledBtn,
            ]}
            onPress={() =>
              isInactiveMode ? onReactivate(user) : onDeactivate(user)
            }
            disabled={isActionBusy}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isActionBusy ? (
              <ActivityIndicator
                size="small"
                color={isInactiveMode ? colors.primary : "#EF4444"}
              />
            ) : (
              <Ionicons
                name={isInactiveMode ? "refresh-circle-outline" : "ban-outline"}
                size={15}
                color={isInactiveMode ? colors.primary : "#EF4444"}
              />
            )}
            <Text
              style={[
                styles.actionBtnTxt,
                { color: isInactiveMode ? colors.primary : "#EF4444" },
              ]}
            >
              {isInactiveMode ? "Réactiver" : "Désactiver"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const UserManagementScreen = () => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const [users, setUsers] = useState([]);
  const [allUsersForCounts, setAllUsersForCounts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState("active");

  const [editUser, setEditUser] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [reactivateTarget, setReactivateTarget] = useState(null);
  const [reactivatingId, setReactivatingId] = useState(null);

  const searchTimeout = useRef(null);

  const loadLookups = useCallback(async () => {
    const [rolesRes, depsRes] = await Promise.all([
      adminUserService.getRoles(),
      adminUserService.getDepartments(),
    ]);

    const normalizedRoles = normalizeBackendItems(extractArray(rolesRes));
    const normalizedDepartments = normalizeDepartments(extractArray(depsRes));

    setRoles(normalizedRoles);
    setDepartments(normalizedDepartments);
  }, []);

  const loadUsers = useCallback(async (opts = {}) => {
    const { isRefresh = false, searchVal = "", statusVal = "active" } = opts;

    try {
      isRefresh ? setRefreshing(true) : setLoading(true);

      const res = await adminUserService.getAllUsers({
        search: searchVal || undefined,
        isActive: statusVal === "inactive" ? false : true,
      });

      setUsers(extractArray(res));
    } catch (error) {
      logger.debug("Load users error:", error);
      Alert.alert("Erreur", "Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadAllUsersForCounts = useCallback(async () => {
    const res = await adminUserService.getAllUsers();

    setAllUsersForCounts(extractArray(res));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadAll = async () => {
        try {
          setLoading(true);

          await loadLookups();

          if (!isActive) return;

          await Promise.all([
            loadAllUsersForCounts(),
            loadUsers({
              searchVal: "",
              statusVal: "active",
            }),
          ]);
        } catch {
          Alert.alert("Erreur", "Impossible de charger les données.");
          setLoading(false);
        }
      };

      loadAll();

      return () => {
        isActive = false;
      };
    }, [loadAllUsersForCounts, loadLookups, loadUsers]),
  );

  const onSearchChange = (text) => {
    setSearch(text);
    clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(() => {
      loadUsers({ searchVal: text, statusVal: statusFilter });
    }, 450);
  };

  const applyDepartmentFilter = (val) => {
    const next = val === departmentFilter ? null : val;
    setDepartmentFilter(next);
  };

  const resetFilters = () => {
    setSearch("");
    setDepartmentFilter(null);
    loadUsers({ searchVal: "", statusVal: statusFilter });
  };

  const applyStatusFilter = (next) => {
    if (next === statusFilter) return;

    setStatusFilter(next);
    setSearch("");
    setDepartmentFilter(null);
    loadUsers({ searchVal: "", statusVal: next });
  };

  const refreshUsers = useCallback(async () => {
    await Promise.all([
      loadUsers({
        isRefresh: true,
        searchVal: search,
        statusVal: statusFilter,
      }),
      loadAllUsersForCounts(),
    ]);
  }, [loadAllUsersForCounts, loadUsers, search, statusFilter]);

  const handleSave = async (id, dto) => {
    const res = await adminUserService.updateUser(id, dto);
    const updated = res?.data?.data ?? res?.data;

    setUsers((prev) =>
      prev.map((u) =>
        (u.id ?? u.Id) === id
          ? {
              ...u,
              ...updated,
              departmentId: dto.departmentId,
              DepartmentId: dto.departmentId,
              roleId: dto.roleId,
              RoleId: dto.roleId,
            }
          : u,
      ),
    );

    await refreshUsers();
  };

  const handleDeactivate = (user) => {
    setDeactivateTarget(user);
  };

  const confirmDeactivateUser = async () => {
    const user = deactivateTarget;
    if (!user) return;

    const id = user.id ?? user.Id;

    setDeactivatingId(id);

    try {
      await adminUserService.deactivateUser(id);
      setUsers((prev) => prev.filter((u) => (u.id ?? u.Id) !== id));
      await refreshUsers();
      setDeactivateTarget(null);
    } catch (error) {
      console.log("Deactivate user error:", {
        status: error?.response?.status ?? error?.status,
        data: error?.response?.data ?? error?.data,
        url: error?.config?.url ?? error?.url,
        method: error?.config?.method ?? error?.method,
      });

      Alert.alert(
        "Erreur",
        error?.response?.data?.message ||
          error?.response?.data?.title ||
          error?.data?.message ||
          error?.data?.title ||
          error?.message ||
          "Impossible de désactiver le compte.",
      );
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleReactivate = (user) => {
    setReactivateTarget(user);
  };

  const confirmReactivateUser = async () => {
    const user = reactivateTarget;
    if (!user) return;

    const id = user.id ?? user.Id;

    setReactivatingId(id);

    try {
      await adminUserService.reactivateUser(id);
      setUsers((prev) => prev.filter((u) => (u.id ?? u.Id) !== id));
      await refreshUsers();
      setReactivateTarget(null);
    } catch (error) {
      console.log("Reactivate user error:", {
        status: error?.response?.status ?? error?.status,
        data: error?.response?.data ?? error?.data,
        url: error?.config?.url ?? error?.url,
        method: error?.config?.method ?? error?.method,
      });

      Alert.alert(
        "Erreur",
        error?.response?.data?.message ||
          error?.response?.data?.title ||
          error?.data?.message ||
          error?.data?.title ||
          error?.message ||
          "Impossible de réactiver le compte.",
      );
    } finally {
      setReactivatingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!departmentFilter) return users;

    return users.filter((u) => {
      const role = getRoleValueFromUser(u, roles);
      if (isAdminRoleValue(role, roles)) return false;

      const deptId = u.departmentId ?? u.DepartmentId;
      return deptId === departmentFilter;
    });
  }, [users, departmentFilter, roles]);

  const activeCount = allUsersForCounts.filter(
    (u) => u.isActive ?? u.IsActive,
  ).length;

  const inactiveCount = allUsersForCounts.filter(
    (u) => !(u.isActive ?? u.IsActive),
  ).length;

  const roleCounts = useMemo(() => {
    const counts = {};

    allUsersForCounts.forEach((u) => {
      const role = getRoleValueFromUser(u, roles);

      if (role) {
        counts[role] = (counts[role] ?? 0) + 1;
      }
    });

    return counts;
  }, [allUsersForCounts, roles]);

  const departmentCounts = useMemo(() => {
    const counts = {};

    allUsersForCounts.forEach((u) => {
      const role = getRoleValueFromUser(u, roles);
      if (isAdminRoleValue(role, roles)) return;

      const deptId = u.departmentId ?? u.DepartmentId;
      if (!deptId) return;
      counts[deptId] = (counts[deptId] ?? 0) + 1;
    });

    return counts;
  }, [allUsersForCounts, roles]);

  const managerRoleId = roles.find(
    (role) =>
      String(role.label ?? "")
        .trim()
        .toLowerCase() === "manager",
  )?.value;

  const adminRoleId = roles.find(
    (role) =>
      String(role.label ?? "")
        .trim()
        .toLowerCase() === "admin",
  )?.value;

  const managerCount = managerRoleId ? (roleCounts[managerRoleId] ?? 0) : 0;
  const adminCount = adminRoleId ? (roleCounts[adminRoleId] ?? 0) : 0;

  const hasFilters = !!search || !!departmentFilter;

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons
          name="search-outline"
          size={17}
          color={colors.textSecondary}
        />

        <TextInput
          style={styles.searchInput}
          placeholder="Nom, email ou département"
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={onSearchChange}
        />

        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearch("");
              loadUsers({ searchVal: "", statusVal: statusFilter });
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="close-circle"
              size={17}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {hasFilters && (
        <TouchableOpacity style={styles.resetFiltersBtn} onPress={resetFilters}>
          <Text style={styles.resetText}>Réinitialiser les filtres</Text>
        </TouchableOpacity>
      )}

      <View style={styles.statusFilterRow}>
        {[
          {
            key: "active",
            label: "Actifs",
            icon: "checkmark-circle-outline",
            color: "#10B981",
            count: activeCount,
          },
          {
            key: "inactive",
            label: "Inactifs",
            icon: "ban-outline",
            color: "#EF4444",
            count: inactiveCount,
          },
        ].map((item) => {
          const active = statusFilter === item.key;

          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.85}
              style={[
                styles.statusChip,
                active && {
                  borderColor: item.color,
                  backgroundColor: `${item.color}14`,
                },
              ]}
              onPress={() => applyStatusFilter(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={13}
                color={active ? item.color : colors.textSecondary}
              />
              <Text
                style={[
                  styles.statusChipText,
                  active && {
                    color: item.color,
                    fontWeight: typography.semibold,
                  },
                ]}
              >
                {item.label}
              </Text>
              <Text
                style={[
                  styles.filterCountText,
                  active && { color: item.color },
                ]}
              >
                {item.count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {departments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              !departmentFilter && {
                backgroundColor: `${colors.primary}18`,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => setDepartmentFilter(null)}
          >
            <Ionicons
              name="business-outline"
              size={12}
              color={!departmentFilter ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.filterChipText,
                !departmentFilter && {
                  color: colors.primary,
                  fontWeight: typography.semibold,
                },
              ]}
            >
              Tous
            </Text>
          </TouchableOpacity>

          {departments.map((d) => {
            const active = departmentFilter === d.value;
            const count = departmentCounts[d.value] ?? 0;

            return (
              <TouchableOpacity
                key={d.value}
                style={[
                  styles.filterChip,
                  active && {
                    backgroundColor: `${colors.primary}18`,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => applyDepartmentFilter(d.value)}
              >
                <Ionicons
                  name="business-outline"
                  size={12}
                  color={active ? colors.primary : colors.textSecondary}
                />

                <Text
                  style={[
                    styles.filterChipText,
                    active && {
                      color: colors.primary,
                      fontWeight: typography.semibold,
                    },
                  ]}
                >
                  {d.label}
                </Text>

                <Text
                  style={[
                    styles.filterCountText,
                    active && { color: colors.primary },
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.statsRow}>
        {[
          {
            num: allUsersForCounts.length,
            label: "Total",
            icon: "people-outline",
            color: colors.primary,
          },
          {
            num: inactiveCount,
            label: "Inactifs",
            icon: "ban-outline",
            color: "#EF4444",
          },
          {
            num: managerCount,
            label: "Managers",
            icon: "people-outline",
            color: "#8B5CF6",
          },
          {
            num: adminCount,
            label: "Admins",
            icon: "shield-checkmark-outline",
            color: "#F59E0B",
          },
        ].map((s, i, arr) => (
          <React.Fragment key={s.label}>
            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIconWrap,
                  { backgroundColor: `${s.color}14` },
                ]}
              >
                <Ionicons name={s.icon} size={11} color={s.color} />
              </View>
              <Text style={[styles.statNum, { color: s.color }]}>{s.num}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>

            {i < arr.length - 1 && <View style={styles.statDivider} />}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          Liste des utilisateurs · {filteredUsers.length}
        </Text>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshUsers}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Chargement…</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.centered}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="people-outline"
                size={36}
                color={colors.textSecondary}
              />
            </View>

            <Text style={styles.emptyTitle}>Aucun utilisateur trouvé</Text>

            <Text style={styles.emptyText}>
              Modifiez votre recherche ou réinitialisez les filtres.
            </Text>

            {hasFilters && (
              <TouchableOpacity
                style={[styles.emptyAction, { borderColor: colors.primary }]}
                onPress={resetFilters}
              >
                <Text
                  style={[styles.emptyActionTxt, { color: colors.primary }]}
                >
                  Réinitialiser les filtres
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredUsers.map((user) => (
            <UserCard
              key={user.id ?? user.Id}
              user={user}
              roles={roles}
              deactivatingId={deactivatingId}
              reactivatingId={reactivatingId}
              statusFilter={statusFilter}
              onEdit={setEditUser}
              onDeactivate={handleDeactivate}
              onReactivate={handleReactivate}
              colors={colors}
              styles={styles}
              typography={typography}
            />
          ))
        )}
      </ScrollView>

      <EditModal
        visible={!!editUser}
        user={editUser}
        roles={roles}
        departments={departments}
        onClose={() => setEditUser(null)}
        onSave={handleSave}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
      />

      <DeactivateUserModal
        visible={!!deactivateTarget}
        user={deactivateTarget}
        submitting={!!deactivatingId}
        onCancel={() => {
          if (!deactivatingId) {
            setDeactivateTarget(null);
          }
        }}
        onConfirm={confirmDeactivateUser}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
      />

      <ReactivateUserModal
        visible={!!reactivateTarget}
        user={reactivateTarget}
        submitting={!!reactivatingId}
        onCancel={() => {
          if (!reactivatingId) {
            setReactivateTarget(null);
          }
        }}
        onConfirm={confirmReactivateUser}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
      />
    </View>
  );
};

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      backgroundColor: colors.surface,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      borderRadius: borderRadius.lg,
      paddingVertical: 9,
      paddingHorizontal: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },

    statItem: {
      alignItems: "center",
      gap: 2,
    },

    statIconWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 1,
    },

    statNum: {
      fontSize: typography.base,
      fontWeight: typography.bold,
    },

    statLabel: {
      fontSize: 10,
      color: colors.textSecondary,
    },

    statDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
    },

    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 11,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.xs,
      ...shadows.sm,
    },

    searchInput: {
      flex: 1,
      fontSize: typography.sm,
      color: colors.text,
    },

    resetText: {
      fontSize: typography.xs,
      color: colors.primary,
      fontWeight: typography.semibold,
    },

    statusFilterRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },

    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: borderRadius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    statusChipText: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      fontWeight: typography.medium,
    },

    filtersScroll: {
      maxHeight: 44,
      marginBottom: spacing.xs,
    },

    filtersContent: {
      paddingHorizontal: spacing.lg,
      gap: 8,
      alignItems: "center",
    },

    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: borderRadius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    filterChipText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: typography.medium,
    },

    filterCountText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: typography.semibold,
      opacity: 0.85,
    },

    list: { flex: 1 },

    listContent: {
      padding: spacing.lg,
      paddingTop: spacing.xs,
      gap: 10,
      paddingBottom: 40,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },

    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: spacing.sm,
    },

    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },

    avatarText: {
      fontSize: 15,
      fontWeight: typography.bold,
    },

    cardHeaderText: { flex: 1 },

    userName: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },

    userEmail: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 1,
    },

    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
    },

    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },

    statusText: {
      fontSize: 11,
      fontWeight: typography.semibold,
    },
    resetFiltersBtn: {
      alignSelf: "flex-end",
      marginHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },

    listHeader: {
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },

    listHeaderText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },

    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
    },

    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },

    metaIconWrap: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },

    metaText: {
      fontSize: typography.xs,
      color: colors.textSecondary,
    },

    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.border,
    },

    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    cardDate: {
      fontSize: typography.xs,
      color: colors.textSecondary,
    },

    cardActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },

    actionDivider: {
      width: 1,
      height: 18,
      backgroundColor: colors.border,
      marginHorizontal: 4,
    },

    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: borderRadius.md,
      backgroundColor: `${colors.primary}10`,
    },

    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: borderRadius.md,
      backgroundColor: "rgba(239,68,68,0.08)",
    },

    reactivateBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: borderRadius.md,
      backgroundColor: `${colors.primary}10`,
    },

    disabledBtn: {
      opacity: 0.45,
    },

    actionBtnTxt: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
    },

    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },

    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },

    loadingText: {
      marginTop: 12,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    emptyTitle: {
      fontSize: typography.lg,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: 6,
    },

    emptyText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      paddingHorizontal: spacing.xl,
    },

    emptyAction: {
      marginTop: spacing.lg,
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.full,
      borderWidth: 1.5,
    },

    emptyActionTxt: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
    },
  });

export default UserManagementScreen;
