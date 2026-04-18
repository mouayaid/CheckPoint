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
  Animated,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { adminUserService } from "../../services/api/adminUserService";

/* ─────────── Constants ─────────── */
const ROLE_OPTIONS = [
  { label: "Employé",  value: 1, icon: "person-outline",           color: "#3B82F6" },
  { label: "Manager",  value: 2, icon: "people-outline",           color: "#8B5CF6" },
  { label: "Admin",    value: 3, icon: "shield-checkmark-outline", color: "#E11D48" },
  { label: "RH",       value: 4, icon: "briefcase-outline",        color: "#F59E0B" },
];

const STATUS_FILTERS = [
  { label: "Tous",      value: null },
  { label: "Actifs",   value: true },
  { label: "Inactifs", value: false },
];

/* ─────────── Helpers ─────────── */
const extractArray = (res) => {
  if (Array.isArray(res?.data))       return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
};

const normalizeRole = (r) => {
  if (typeof r === "number") return r;
  if (typeof r === "string") {
    const l = r.trim().toLowerCase();
    if (l === "employee" || l === "user") return 1;
    if (l === "manager") return 2;
    if (l === "admin")   return 3;
    if (l === "hr")      return 4;
  }
  return 1;
};

const getRoleMeta = (v) => ROLE_OPTIONS.find((r) => r.value === v) ?? ROLE_OPTIONS[0];

const fmt = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString("fr-FR");
};

/* ══════════════════════════════════
   Edit Modal
══════════════════════════════════ */
const EditModal = ({ visible, user, onClose, onSave, colors, spacing, typography, borderRadius }) => {
  const [fullName, setFullName]       = useState("");
  const [leaveBalance, setLeaveBalance] = useState("");
  const [selectedRole, setSelectedRole] = useState(1);
  const [saving, setSaving]           = useState(false);

  React.useEffect(() => {
    if (user) {
      setFullName(user.fullName ?? user.FullName ?? "");
      setLeaveBalance(String(user.leaveBalance ?? user.LeaveBalance ?? ""));
      setSelectedRole(normalizeRole(user.role ?? user.Role));
    }
  }, [user]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("Validation", "Le nom complet est obligatoire.");
      return;
    }
    const lb = Number(leaveBalance);
    if (isNaN(lb) || lb < 0) {
      Alert.alert("Validation", "Solde de congés invalide.");
      return;
    }
    setSaving(true);
    try {
      await onSave(user.id ?? user.Id, {
        fullName: fullName.trim(),
        role: selectedRole,
        departmentId: user.departmentId ?? user.DepartmentId ?? 1,
        leaveBalance: lb,
      });
      onClose();
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour l'utilisateur.");
    } finally {
      setSaving(false);
    }
  };

  const s = useMemo(() => StyleSheet.create({
    overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet:     { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: 36 },
    handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg },
    title:     { fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text, marginBottom: spacing.lg },
    label:     { fontSize: typography.sm, fontWeight: typography.medium, color: colors.textSecondary, marginBottom: 6 },
    input:     { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: typography.base, color: colors.text, marginBottom: spacing.md },
    roleRow:   { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: spacing.lg },
    roleChip:  { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
    roleChipSel: { borderColor: colors.primary, backgroundColor: `${colors.primary}18` },
    roleChipTxt: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium },
    roleChipTxtSel: { color: colors.primary, fontWeight: typography.semibold },
    btnRow:    { flexDirection: "row", gap: 10 },
    cancel:    { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: borderRadius.lg, borderWidth: 1.5, borderColor: colors.border },
    cancelTxt: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textSecondary },
    save:      { flex: 2, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: borderRadius.lg, backgroundColor: colors.primary },
    saveTxt:   { fontSize: typography.base, fontWeight: typography.semibold, color: "#fff" },
  }), [colors, spacing, typography, borderRadius]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>Modifier l'utilisateur</Text>

          <Text style={s.label}>Nom complet</Text>
          <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="Nom complet" placeholderTextColor={colors.placeholder} editable={!saving} />

          <Text style={s.label}>Solde de congés</Text>
          <TextInput style={s.input} value={leaveBalance} onChangeText={setLeaveBalance} keyboardType="numeric" placeholder="ex. 18" placeholderTextColor={colors.placeholder} editable={!saving} />

          <Text style={s.label}>Rôle</Text>
          <View style={s.roleRow}>
            {ROLE_OPTIONS.map((opt) => {
              const sel = selectedRole === opt.value;
              return (
                <TouchableOpacity key={opt.value} style={[s.roleChip, sel && s.roleChipSel]} onPress={() => setSelectedRole(opt.value)} disabled={saving}>
                  <Ionicons name={opt.icon} size={14} color={sel ? colors.primary : colors.textSecondary} />
                  <Text style={[s.roleChipTxt, sel && s.roleChipTxtSel]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.btnRow}>
            <TouchableOpacity style={s.cancel} onPress={onClose} disabled={saving}>
              <Text style={s.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.save} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Enregistrer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ══════════════════════════════════
   Main Screen
══════════════════════════════════ */
const UserManagementScreen = () => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, spacing, typography, borderRadius, shadows), [colors, spacing, typography, borderRadius, shadows]);

  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState(null);   // null | 1..4
  const [statusFilter, setStatusFilter] = useState(null); // null | true | false
  const [editUser, setEditUser]     = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [roleChangingId, setRoleChangingId] = useState(null);

  const searchTimeout = useRef(null);

  const loadUsers = useCallback(async (opts = {}) => {
    const { isRefresh = false, searchVal = search, roleVal = roleFilter, statusVal = statusFilter } = opts;
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await adminUserService.getAllUsers({
        search: searchVal || undefined,
        role: roleVal ? ROLE_OPTIONS.find((r) => r.value === roleVal)?.label : undefined,
        isActive: statusVal,
      });
      setUsers(extractArray(res));
    } catch {
      Alert.alert("Erreur", "Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, roleFilter, statusFilter]);

  useFocusEffect(useCallback(() => { loadUsers(); }, []));

  /* debounced search */
  const onSearchChange = (text) => {
    setSearch(text);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadUsers({ searchVal: text }), 450);
  };

  const applyRoleFilter = (val) => {
    const next = val === roleFilter ? null : val;
    setRoleFilter(next);
    loadUsers({ roleVal: next });
  };

  const applyStatusFilter = (val) => {
    const next = val === statusFilter ? null : val;
    setStatusFilter(next);
    loadUsers({ statusVal: next });
  };

  /* ─── Handlers ─── */
  const handleSave = async (id, dto) => {
    const res = await adminUserService.updateUser(id, dto);
    const updated = res?.data?.data ?? res?.data;
    setUsers((prev) => prev.map((u) => ((u.id ?? u.Id) === id ? { ...u, ...updated } : u)));
  };

  const handleDelete = (user) => {
    const id = user.id ?? user.Id;
    const name = user.fullName ?? user.FullName ?? "cet utilisateur";
    Alert.alert(
      "Supprimer l'utilisateur",
      `Voulez-vous vraiment supprimer "${name}" ? Cette action est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            setDeletingId(id);
            try {
              await adminUserService.deleteUser(id);
              setUsers((prev) => prev.filter((u) => (u.id ?? u.Id) !== id));
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer l'utilisateur.");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleRoleChange = async (user, newRole) => {
    const id = user.id ?? user.Id;
    setRoleChangingId(id);
    try {
      await adminUserService.changeRole(id, newRole);
      setUsers((prev) => prev.map((u) => ((u.id ?? u.Id) === id ? { ...u, role: newRole, Role: newRole } : u)));
    } catch {
      Alert.alert("Erreur", "Impossible de changer le rôle.");
    } finally {
      setRoleChangingId(null);
    }
  };

  /* ─── Render helpers ─── */
  const renderUserCard = (user) => {
    const id        = user.id ?? user.Id;
    const name      = user.fullName ?? user.FullName ?? "—";
    const email     = user.email ?? user.Email ?? "—";
    const dept      = user.departmentName ?? user.DepartmentName ?? "—";
    const isActive  = user.isActive ?? user.IsActive ?? false;
    const role      = normalizeRole(user.role ?? user.Role);
    const roleMeta  = getRoleMeta(role);
    const isDeleting = deletingId === id;
    const isChangingRole = roleChangingId === id;

    return (
      <View key={id} style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: `${roleMeta.color}18` }]}>
            <Ionicons name={roleMeta.icon} size={20} color={roleMeta.color} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.userName} numberOfLines={1}>{name}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{email}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? "#D1FAE5" : "#FEE2E2" }]}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? "#10B981" : "#EF4444" }]} />
            <Text style={[styles.statusText, { color: isActive ? "#065F46" : "#991B1B" }]}>
              {isActive ? "Actif" : "Inactif"}
            </Text>
          </View>
        </View>

        {/* Info Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="business-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.infoText} numberOfLines={1}>{dept}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.infoText}>{fmt(user.createdAt ?? user.CreatedAt)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="leaf-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.infoText}>{user.leaveBalance ?? user.LeaveBalance ?? "—"} j</Text>
          </View>
        </View>

        {/* Role Chips */}
        <View style={styles.roleSection}>
          <Text style={styles.roleLabel}>Rôle :</Text>
          <View style={styles.roleChipsRow}>
            {ROLE_OPTIONS.map((opt) => {
              const sel = role === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.roleChip, sel && { backgroundColor: `${opt.color}18`, borderColor: opt.color }]}
                  onPress={() => !isChangingRole && handleRoleChange(user, opt.value)}
                  disabled={isChangingRole || sel}
                >
                  {isChangingRole && sel ? (
                    <ActivityIndicator size="small" color={opt.color} />
                  ) : (
                    <Ionicons name={opt.icon} size={12} color={sel ? opt.color : colors.textSecondary} />
                  )}
                  <Text style={[styles.roleChipText, sel && { color: opt.color, fontWeight: typography.semibold }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditUser(user)}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteBtn, isDeleting && styles.disabledBtn]}
            onPress={() => handleDelete(user)}
            disabled={isDeleting}
          >
            {isDeleting
              ? <ActivityIndicator size="small" color="#EF4444" />
              : <Ionicons name="trash-outline" size={16} color="#EF4444" />}
            <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /* ─── Stats ─── */
  const activeCount   = users.filter((u) => u.isActive ?? u.IsActive).length;
  const inactiveCount = users.length - activeCount;

  return (
    <View style={styles.container}>
      {/* ── Search Bar ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom, email ou département..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={onSearchChange}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(""); loadUsers({ searchVal: "" }); }}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filters ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
        {/* Status filters */}
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={String(f.value)}
            style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}
            onPress={() => applyStatusFilter(f.value)}
          >
            <Text style={[styles.filterChipText, statusFilter === f.value && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.filterDivider} />
        {/* Role filters */}
        {ROLE_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.filterChip, roleFilter === r.value && { backgroundColor: `${r.color}18`, borderColor: r.color }]}
            onPress={() => applyRoleFilter(r.value)}
          >
            <Ionicons name={r.icon} size={12} color={roleFilter === r.value ? r.color : colors.textSecondary} />
            <Text style={[styles.filterChipText, roleFilter === r.value && { color: r.color, fontWeight: typography.semibold }]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Stats Strip ── */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{users.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: "#10B981" }]}>{activeCount}</Text>
          <Text style={styles.statLabel}>Actifs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: "#EF4444" }]}>{inactiveCount}</Text>
          <Text style={styles.statLabel}>Inactifs</Text>
        </View>
      </View>

      {/* ── List ── */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadUsers({ isRefresh: true })} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Chargement des utilisateurs…</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="people-outline" size={56} color={colors.border} />
            <Text style={styles.emptyTitle}>Aucun utilisateur trouvé</Text>
            <Text style={styles.emptyText}>Essayez de modifier votre recherche ou filtre.</Text>
          </View>
        ) : (
          users.map(renderUserCard)
        )}
      </ScrollView>

      {/* ── Edit Modal ── */}
      <EditModal
        visible={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSave={handleSave}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
      />
    </View>
  );
};

/* ══════════════════════════════════
   Styles
══════════════════════════════════ */
const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    container:   { flex: 1, backgroundColor: colors.background },

    searchBar: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: colors.surface, borderRadius: borderRadius.lg,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: spacing.md, paddingVertical: 10,
      margin: spacing.lg, marginBottom: spacing.sm,
      ...shadows.sm,
    },
    searchInput: { flex: 1, fontSize: typography.sm, color: colors.text },

    filtersScroll:   { maxHeight: 44 },
    filtersContent:  { paddingHorizontal: spacing.lg, gap: 8, alignItems: "center" },
    filterChip: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterChipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText:       { fontSize: 12, color: colors.textSecondary, fontWeight: typography.medium },
    filterChipTextActive: { color: "#fff", fontWeight: typography.semibold },
    filterDivider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 4 },

    statsRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-around",
      backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginVertical: spacing.sm,
      borderRadius: borderRadius.lg, paddingVertical: 12, borderWidth: 1, borderColor: colors.border,
      ...shadows.sm,
    },
    statItem:    { alignItems: "center" },
    statNum:     { fontSize: typography.xl, fontWeight: typography.bold, color: colors.text },
    statLabel:   { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
    statDivider: { width: 1, height: 28, backgroundColor: colors.border },

    list:        { flex: 1 },
    listContent: { padding: spacing.lg, paddingTop: spacing.sm, gap: 12, paddingBottom: 40 },

    card: {
      backgroundColor: colors.surface, borderRadius: borderRadius.lg,
      padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
      ...shadows.md,
    },
    cardHeader:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.md },
    avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    cardHeaderText: { flex: 1 },
    userName:  { fontSize: typography.base, fontWeight: typography.semibold, color: colors.text },
    userEmail: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
    statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.full },
    statusDot:   { width: 6, height: 6, borderRadius: 3 },
    statusText:  { fontSize: 11, fontWeight: typography.semibold },

    infoRow:  { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: spacing.md },
    infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    infoText: { fontSize: typography.xs, color: colors.textSecondary },

    roleSection:  { marginBottom: spacing.md },
    roleLabel:    { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.medium, marginBottom: 6 },
    roleChipsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    roleChip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: borderRadius.full, borderWidth: 1.5,
      borderColor: colors.border, backgroundColor: colors.surfaceMuted,
    },
    roleChipText: { fontSize: 11, color: colors.textSecondary },

    actionsRow:  { flexDirection: "row", gap: 10, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight ?? colors.border },
    editBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
    deleteBtn:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: "#EF4444", backgroundColor: "rgba(239,68,68,0.08)" },
    disabledBtn: { opacity: 0.5 },
    actionBtnText: { fontSize: typography.sm, fontWeight: typography.semibold },

    centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
    loadingText: { marginTop: 12, fontSize: typography.sm, color: colors.textSecondary },
    emptyTitle:  { fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text, marginTop: 16 },
    emptyText:   { fontSize: typography.sm, color: colors.textSecondary, textAlign: "center", marginTop: 6 },
  });

export default UserManagementScreen;
