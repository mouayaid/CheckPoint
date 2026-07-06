import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { adminUserService, departmentService } from "../../services/api";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const arrayFrom = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const valueOf = (item, camel, pascal, fallback = "") =>
  item?.[camel] ?? item?.[pascal] ?? fallback;

const isAdminUser = (user) => {
  const roleId = valueOf(user, "roleId", "RoleId", null);
  const roleName = valueOf(
    user,
    "roleName",
    "RoleName",
    valueOf(user, "role", "Role", ""),
  );
  return Number(roleId) === 3 || String(roleName).trim().toLowerCase() === "admin";
};

const errorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.errors?.[0] ||
  error?.message ||
  fallback;

export default function DepartmentManagementScreen() {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedIds, setExpandedIds] = useState({});
  const [actionsFor, setActionsFor] = useState(null);
  const [editor, setEditor] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [transferUser, setTransferUser] = useState(null);
  const [targetDepartmentId, setTargetDepartmentId] = useState(null);
  const [transferring, setTransferring] = useState(false);

  const loadData = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [departmentItems, usersResponse] = await Promise.all([
        departmentService.getDepartments(),
        adminUserService.getAllUsers(),
      ]);
      setDepartments(arrayFrom(departmentItems));
      setUsers(arrayFrom(usersResponse));
    } catch (error) {
      Alert.alert(
        "Erreur",
        errorMessage(error, "Impossible de charger les départements."),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const usersByDepartment = useMemo(() => {
    const grouped = {};
    users.forEach((user) => {
      if (isAdminUser(user)) return;
      const id = valueOf(user, "departmentId", "DepartmentId", null);
      if (id == null) return;
      (grouped[String(id)] ||= []).push(user);
    });
    return grouped;
  }, [users]);

  const openEditor = (department = null) => {
    setActionsFor(null);
    setEditor(department || {});
    setName(department ? valueOf(department, "name", "Name") : "");
  };

  const saveDepartment = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Nom requis", "Saisissez le nom du département.");
      return;
    }
    const editingId = valueOf(editor, "id", "Id", null);
    const duplicate = departments.some((department) => {
      const id = valueOf(department, "id", "Id");
      const existingName = valueOf(department, "name", "Name");
      return id !== editingId && existingName.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase();
    });
    if (duplicate) {
      Alert.alert("Nom déjà utilisé", "Un département portant ce nom existe déjà.");
      return;
    }

    setSaving(true);
    try {
      if (editingId == null) await departmentService.createDepartment(trimmedName);
      else await departmentService.updateDepartment(editingId, trimmedName);
      setEditor(null);
      await loadData(true);
    } catch (error) {
      Alert.alert("Erreur", errorMessage(error, "Impossible d’enregistrer le département."));
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (department) => {
    setActionsFor(null);
    const id = valueOf(department, "id", "Id");
    const assignedUsers = usersByDepartment[String(id)] || [];
    if (assignedUsers.length) {
      Alert.alert(
        "Suppression impossible",
        `Ce département contient ${assignedUsers.length} utilisateur${assignedUsers.length > 1 ? "s" : ""}. Réaffectez-les avant de le supprimer.`,
      );
      return;
    }
    Alert.alert(
      "Supprimer le département",
      `Voulez-vous vraiment supprimer « ${valueOf(department, "name", "Name")} » ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setDeletingId(id);
            try {
              await departmentService.deleteDepartment(id);
              await loadData(true);
            } catch (error) {
              Alert.alert("Suppression impossible", errorMessage(error, "Ce département ne peut pas être supprimé."));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const toggleExpanded = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds((current) => ({ ...current, [id]: !current[id] }));
  };

  const openTransfer = (user) => {
    if (isAdminUser(user)) return;
    const currentId = valueOf(user, "departmentId", "DepartmentId", null);
    const firstAlternative = departments.find(
      (department) => valueOf(department, "id", "Id") !== currentId,
    );
    setTransferUser(user);
    setTargetDepartmentId(
      firstAlternative ? valueOf(firstAlternative, "id", "Id") : currentId,
    );
  };

  const closeTransfer = () => {
    if (transferring) return;
    setTransferUser(null);
    setTargetDepartmentId(null);
  };

  const saveTransfer = async () => {
    const userId = valueOf(transferUser, "id", "Id", null);
    const currentId = valueOf(
      transferUser,
      "departmentId",
      "DepartmentId",
      null,
    );
    if (userId == null || targetDepartmentId == null || targetDepartmentId === currentId) {
      Alert.alert(
        "Département requis",
        "Choisissez un département différent du département actuel.",
      );
      return;
    }

    const fullName = valueOf(transferUser, "fullName", "FullName").trim();
    const roleId = valueOf(transferUser, "roleId", "RoleId", null);
    const leaveBalance = Number(
      valueOf(transferUser, "leaveBalance", "LeaveBalance", 0),
    );
    if (!fullName || roleId == null || Number.isNaN(leaveBalance)) {
      Alert.alert(
        "Transfert impossible",
        "Les informations actuelles de cet utilisateur sont incomplètes.",
      );
      return;
    }

    setTransferring(true);
    try {
      await adminUserService.updateUser(userId, {
        fullName,
        roleId,
        departmentId: targetDepartmentId,
        leaveBalance,
      });
      setTransferUser(null);
      setTargetDepartmentId(null);
      await loadData(true);
    } catch (error) {
      Alert.alert(
        "Transfert impossible",
        errorMessage(error, "Impossible de changer le département."),
      );
    } finally {
      setTransferring(false);
    }
  };

  const themed = {
    page: { backgroundColor: colors.background },
    text: { color: colors.textPrimary },
    secondary: { color: colors.textSecondary },
    card: { backgroundColor: colors.surface, borderColor: colors.border, ...shadows.sm },
    input: { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary },
  };

  const renderUser = (user, index) => {
    const firstName = valueOf(user, "firstName", "FirstName");
    const lastName = valueOf(user, "lastName", "LastName");
    const fullName = valueOf(user, "fullName", "FullName", `${firstName} ${lastName}`.trim() || "Utilisateur");
    const active = Boolean(valueOf(user, "isActive", "IsActive", false));
    const role = valueOf(user, "roleName", "RoleName", valueOf(user, "role", "Role", "—"));
    return (
      <View key={String(valueOf(user, "id", "Id", index))} style={[styles.userRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="person-outline" size={17} color={colors.primaryDark} />
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, themed.text]}>{fullName}</Text>
          <Text style={[styles.userEmail, themed.secondary]} numberOfLines={1}>{valueOf(user, "email", "Email", "—")}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.role, themed.secondary]}>{role}</Text>
            <View style={[styles.status, { backgroundColor: active ? colors.successLight : colors.errorLight }]}>
              <View style={[styles.statusDot, { backgroundColor: active ? colors.success : colors.error }]} />
              <Text style={[styles.statusText, { color: active ? colors.success : colors.error }]}>{active ? "Actif" : "Inactif"}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.transferButton, { backgroundColor: colors.surfaceMuted }]}
          onPress={() => openTransfer(user)}
          accessibilityRole="button"
          accessibilityLabel={`Changer le département de ${fullName}`}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={19}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderDepartment = ({ item }) => {
    const id = valueOf(item, "id", "Id");
    const departmentUsers = usersByDepartment[String(id)] || [];
    const expanded = Boolean(expandedIds[id]);
    const deleting = deletingId === id;
    return (
      <View style={[styles.card, themed.card, { borderRadius: borderRadius.lg, marginBottom: spacing.md }]}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpanded(id)} activeOpacity={0.75}>
          <View style={[styles.departmentIcon, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="business-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.departmentInfo}>
            <Text style={[styles.departmentName, themed.text]} numberOfLines={1}>{valueOf(item, "name", "Name")}</Text>
            <Text style={[styles.count, themed.secondary]}>{departmentUsers.length} utilisateur{departmentUsers.length !== 1 ? "s" : ""}</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => setActionsFor(item)} disabled={deleting} accessibilityLabel="Actions du département">
            {deleting ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />}
          </TouchableOpacity>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        {expanded && (
          <View style={[styles.expanded, { borderTopColor: colors.border }]}>
            {departmentUsers.length ? departmentUsers.map(renderUser) : <Text style={[styles.emptyUsers, themed.secondary]}>Aucun utilisateur dans ce département.</Text>}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, themed.page]}>
      <View style={styles.topBar}>
        <Text style={[styles.title, themed.text]}>Gestion des départements</Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]} onPress={() => openEditor()}>
          <Ionicons name="add" size={20} color={colors.textOnPrimary} />
          <Text style={[styles.addText, { color: colors.textOnPrimary }]}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={departments}
          keyExtractor={(item) => String(valueOf(item, "id", "Id"))}
          renderItem={renderDepartment}
          contentContainerStyle={[styles.list, !departments.length && styles.emptyList]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={[styles.emptyUsers, themed.secondary]}>Aucun département.</Text>}
        />
      )}

      <Modal transparent visible={Boolean(actionsFor)} animationType="fade" onRequestClose={() => setActionsFor(null)}>
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => setActionsFor(null)}>
          <Pressable style={[styles.sheet, themed.card, { borderRadius: borderRadius.xl }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, themed.text]}>{actionsFor ? valueOf(actionsFor, "name", "Name") : ""}</Text>
            <TouchableOpacity style={styles.actionRow} onPress={() => openEditor(actionsFor)}>
              <Ionicons name="create-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.actionText, themed.text]}>Modifier le département</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionRow} onPress={() => requestDelete(actionsFor)}>
              <Ionicons name="trash-outline" size={22} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>Supprimer le département</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={Boolean(editor)} animationType="fade" onRequestClose={() => !saving && setEditor(null)}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheet, themed.card, { borderRadius: borderRadius.xl }]}>
            <Text style={[styles.modalTitle, themed.text]}>{valueOf(editor, "id", "Id", null) == null ? "Ajouter un département" : "Modifier le département"}</Text>
            <Text style={[styles.label, themed.secondary]}>Nom</Text>
            <TextInput value={name} onChangeText={setName} autoFocus maxLength={100} editable={!saving} placeholder="Nom du département" placeholderTextColor={colors.placeholder} style={[styles.input, themed.input, { borderRadius: borderRadius.md }]} onSubmitEditing={saveDepartment} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border, borderRadius: borderRadius.md }]} onPress={() => setEditor(null)} disabled={saving}>
                <Text style={[styles.buttonText, themed.text]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]} onPress={saveDepartment} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={Boolean(transferUser)}
        animationType="slide"
        onRequestClose={closeTransfer}
      >
        <Pressable
          style={[styles.bottomOverlay, { backgroundColor: colors.overlay }]}
          onPress={closeTransfer}
        >
          <Pressable
            style={[
              styles.bottomSheet,
              themed.card,
              { borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl },
            ]}
            onPress={() => {}}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, themed.text]}>
              Changer le département
            </Text>
            <Text style={[styles.transferName, themed.text]}>
              {valueOf(transferUser, "fullName", "FullName", "Utilisateur")}
            </Text>
            <Text style={[styles.transferEmail, themed.secondary]}>
              {valueOf(transferUser, "email", "Email", "—")}
            </Text>
            <Text style={[styles.label, themed.secondary]}>Département actuel</Text>
            <Text style={[styles.currentDepartment, themed.text]}>
              {valueOf(transferUser, "departmentName", "DepartmentName", "—")}
            </Text>
            <Text style={[styles.label, themed.secondary]}>Nouveau département</Text>
            <View
              style={[
                styles.pickerWrapper,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Picker
                selectedValue={targetDepartmentId}
                onValueChange={setTargetDepartmentId}
                enabled={!transferring}
                style={{ color: colors.text }}
                dropdownIconColor={colors.text}
                itemStyle={Platform.OS === "ios" ? { color: colors.text } : undefined}
              >
                {departments.map((department) => {
                  const id = valueOf(department, "id", "Id");
                  return (
                    <Picker.Item
                      key={String(id)}
                      label={valueOf(department, "name", "Name")}
                      value={id}
                      color={colors.text}
                    />
                  );
                })}
              </Picker>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border, borderRadius: borderRadius.md }]}
                onPress={closeTransfer}
                disabled={transferring}
              >
                <Text style={[styles.buttonText, themed.text]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor:
                      targetDepartmentId === valueOf(transferUser, "departmentId", "DepartmentId", null)
                        ? colors.border
                        : colors.primary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={saveTransfer}
                disabled={
                  transferring ||
                  targetDepartmentId == null ||
                  targetDepartmentId === valueOf(transferUser, "departmentId", "DepartmentId", null)
                }
              >
                {transferring ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: "700" },
  addButton: { height: 42, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  addText: { fontSize: 14, fontWeight: "600" },
  list: { padding: 16, paddingTop: 4 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, overflow: "hidden" },
  cardHeader: { minHeight: 78, padding: 14, flexDirection: "row", alignItems: "center" },
  departmentIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 12 },
  departmentInfo: { flex: 1 },
  departmentName: { fontSize: 16, fontWeight: "600", marginBottom: 3 },
  count: { fontSize: 13 },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  expanded: { borderTopWidth: 1, paddingHorizontal: 14, paddingBottom: 8 },
  userRow: { flexDirection: "row", paddingVertical: 13 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginRight: 10 },
  userInfo: { flex: 1 },
  transferButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", alignSelf: "center", marginLeft: 8 },
  userName: { fontSize: 14, fontWeight: "600" },
  userEmail: { fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 7, gap: 10 },
  role: { fontSize: 12 },
  status: { flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 11, fontWeight: "600" },
  emptyUsers: { paddingVertical: 22, textAlign: "center", fontSize: 14 },
  overlay: { flex: 1, justifyContent: "center", padding: 22 },
  sheet: { width: "100%", maxWidth: 480, alignSelf: "center", borderWidth: 1, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  actionRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
  actionText: { fontSize: 15, fontWeight: "500" },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 7 },
  input: { borderWidth: 1, height: 48, paddingHorizontal: 13, fontSize: 15 },
  modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  secondaryButton: { minWidth: 100, height: 44, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  saveButton: { minWidth: 110, height: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buttonText: { fontSize: 14, fontWeight: "600" },
  bottomOverlay: { flex: 1, justifyContent: "flex-end" },
  bottomSheet: { width: "100%", maxWidth: 560, alignSelf: "center", borderWidth: 1, padding: 20, paddingBottom: 28 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  transferName: { fontSize: 16, fontWeight: "600" },
  transferEmail: { fontSize: 13, marginTop: 3, marginBottom: 18 },
  currentDepartment: { fontSize: 15, fontWeight: "500", marginBottom: 18 },
  pickerWrapper: { borderWidth: 1, overflow: "hidden", marginBottom: 2 },
});
