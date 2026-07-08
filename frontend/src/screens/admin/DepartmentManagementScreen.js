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

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
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

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase();

const isAdminUser = (user) => {
  const roleId = valueOf(user, "roleId", "RoleId", null);
  const roleName = valueOf(
    user,
    "roleName",
    "RoleName",
    valueOf(user, "role", "Role", ""),
  );

  return Number(roleId) === 3 || normalizeRole(roleName) === "admin";
};

const errorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.errors?.[0] ||
  error?.message ||
  fallback;

const getFullName = (user) => {
  const firstName = valueOf(user, "firstName", "FirstName", "");
  const lastName = valueOf(user, "lastName", "LastName", "");
  return (
    valueOf(user, "fullName", "FullName", "") ||
    `${firstName} ${lastName}`.trim() ||
    "Utilisateur"
  );
};

const getInitials = (name) => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const getRoleLabel = (role) => {
  const normalized = normalizeRole(role);

  if (normalized.includes("manager")) return "Manager";
  if (normalized.includes("employee") || normalized.includes("employé"))
    return "Employé";
  if (normalized.includes("admin")) return "Admin";

  return role || "—";
};

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

  const nonAdminUsers = useMemo(
    () => users.filter((user) => !isAdminUser(user)),
    [users],
  );

  const usersByDepartment = useMemo(() => {
    const grouped = {};

    nonAdminUsers.forEach((user) => {
      const id = valueOf(user, "departmentId", "DepartmentId", null);
      if (id == null) return;

      (grouped[String(id)] ||= []).push(user);
    });

    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) =>
        getFullName(a).localeCompare(getFullName(b), "fr", {
          sensitivity: "base",
        }),
      );
    });

    return grouped;
  }, [nonAdminUsers]);

  const screenStats = useMemo(() => {
    const assignedUsers = nonAdminUsers.filter(
      (user) => valueOf(user, "departmentId", "DepartmentId", null) != null,
    ).length;

    const activeUsers = nonAdminUsers.filter((user) =>
      Boolean(valueOf(user, "isActive", "IsActive", false)),
    ).length;

    return {
      departments: departments.length,
      users: assignedUsers,
      activeUsers,
    };
  }, [departments.length, nonAdminUsers]);

  const getDepartmentName = useCallback(
    (departmentId) => {
      const department = departments.find(
        (item) => valueOf(item, "id", "Id") === departmentId,
      );

      return department ? valueOf(department, "name", "Name", "—") : "—";
    },
    [departments],
  );

  const themed = {
    page: { backgroundColor: colors.background },
    text: { color: colors.textPrimary },
    secondary: { color: colors.textSecondary },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      ...shadows.sm,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderColor: colors.border,
      color: colors.textPrimary,
    },
  };

  const openEditor = (department = null) => {
    setActionsFor(null);
    setEditor(department || {});
    setName(department ? valueOf(department, "name", "Name") : "");
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
    setName("");
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
      const existingName = valueOf(department, "name", "Name", "");

      return (
        id !== editingId &&
        existingName.trim().toLocaleLowerCase() ===
          trimmedName.toLocaleLowerCase()
      );
    });

    if (duplicate) {
      Alert.alert(
        "Nom déjà utilisé",
        "Un département portant ce nom existe déjà.",
      );
      return;
    }

    setSaving(true);

    try {
      if (editingId == null) {
        await departmentService.createDepartment(trimmedName);
      } else {
        await departmentService.updateDepartment(editingId, trimmedName);
      }

      setEditor(null);
      setName("");
      await loadData(true);
    } catch (error) {
      Alert.alert(
        "Erreur",
        errorMessage(error, "Impossible d’enregistrer le département."),
      );
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
        `Ce département contient ${assignedUsers.length} utilisateur${
          assignedUsers.length > 1 ? "s" : ""
        }. Réaffectez-les avant de le supprimer.`,
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
              Alert.alert(
                "Suppression impossible",
                errorMessage(
                  error,
                  "Ce département ne peut pas être supprimé.",
                ),
              );
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
    setExpandedIds((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  const openTransfer = (user) => {
    if (isAdminUser(user)) return;

    const currentId = valueOf(user, "departmentId", "DepartmentId", null);

    const firstAlternative = departments.find(
      (department) => valueOf(department, "id", "Id") !== currentId,
    );

    setTransferUser(user);
    setTargetDepartmentId(
      firstAlternative ? valueOf(firstAlternative, "id", "Id") : null,
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

    if (
      userId == null ||
      targetDepartmentId == null ||
      targetDepartmentId === currentId
    ) {
      Alert.alert(
        "Département requis",
        "Choisissez un département différent du département actuel.",
      );
      return;
    }

    const fullName = getFullName(transferUser);
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

  const renderUser = (user, index) => {
    const fullName = getFullName(user);
    const active = Boolean(valueOf(user, "isActive", "IsActive", false));
    const role = getRoleLabel(
      valueOf(user, "roleName", "RoleName", valueOf(user, "role", "Role", "—")),
    );

    return (
      <View
        key={String(valueOf(user, "id", "Id", index))}
        style={[
          styles.userRow,
          index > 0 && {
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.avatarText, { color: colors.primaryDark }]}>
            {getInitials(fullName)}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={[styles.userName, themed.text]} numberOfLines={1}>
            {fullName}
          </Text>

          <Text style={[styles.userEmail, themed.secondary]} numberOfLines={1}>
            {valueOf(user, "email", "Email", "—")}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.role, themed.secondary]}>{role}</Text>

            <View
              style={[
                styles.status,
                {
                  backgroundColor: active
                    ? colors.successLight
                    : colors.errorLight,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: active ? colors.success : colors.error },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: active ? colors.success : colors.error },
                ]}
              >
                {active ? "Actif" : "Inactif"}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.moveButton,
            {
              backgroundColor: colors.surfaceMuted,
              borderRadius: borderRadius.md,
            },
          ]}
          onPress={() => openTransfer(user)}
          accessibilityRole="button"
          accessibilityLabel={`Déplacer ${fullName} vers un autre département`}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={17}
            color={colors.primary}
          />
          <Text style={[styles.moveText, { color: colors.primary }]}>
            Déplacer
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDepartment = ({ item }) => {
    const id = valueOf(item, "id", "Id");
    const departmentUsers = usersByDepartment[String(id)] || [];
    const expanded = Boolean(expandedIds[id]);
    const deleting = deletingId === id;

    const managersCount = departmentUsers.filter((user) => {
      const role = valueOf(
        user,
        "roleName",
        "RoleName",
        valueOf(user, "role", "Role", ""),
      );

      return normalizeRole(role).includes("manager");
    }).length;

    const employeesCount = Math.max(departmentUsers.length - managersCount, 0);
    const canDelete = departmentUsers.length === 0;

    return (
      <View
        style={[
          styles.card,
          themed.card,
          {
            borderRadius: borderRadius.lg,
            marginBottom: spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => toggleExpanded(id)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Afficher les membres du département ${valueOf(
            item,
            "name",
            "Name",
          )}`}
        >
          <View
            style={[
              styles.departmentIcon,
              { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <Ionicons
              name="business-outline"
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.departmentInfo}>
            <Text
              style={[styles.departmentName, themed.text]}
              numberOfLines={1}
            >
              {valueOf(item, "name", "Name")}
            </Text>

            <Text style={[styles.count, themed.secondary]}>
              {departmentUsers.length} membre
              {departmentUsers.length !== 1 ? "s" : ""}
            </Text>

            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownText, themed.secondary]}>
                {managersCount} manager{managersCount > 1 ? "s" : ""}
              </Text>
              <View
                style={[
                  styles.breakdownDot,
                  { backgroundColor: colors.border },
                ]}
              />
              <Text style={[styles.breakdownText, themed.secondary]}>
                {employeesCount} employé{employeesCount > 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setActionsFor(item)}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Actions du département"
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name="ellipsis-vertical"
                size={20}
                color={colors.textSecondary}
              />
            )}
          </TouchableOpacity>

          <View style={styles.expandHint}>
            <Text style={[styles.expandText, { color: colors.primary }]}>
              {expanded ? "Masquer" : "Voir"}
            </Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.primary}
            />
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={[styles.expanded, { borderTopColor: colors.border }]}>
            {departmentUsers.length ? (
              departmentUsers.map(renderUser)
            ) : (
              <View style={styles.emptyDepartment}>
                <View
                  style={[
                    styles.emptyIcon,
                    { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <Ionicons
                    name="people-outline"
                    size={24}
                    color={colors.textSecondary}
                  />
                </View>
                <Text style={[styles.emptyTitle, themed.text]}>
                  Aucun membre
                </Text>
                <Text style={[styles.emptyText, themed.secondary]}>
                  Les utilisateurs affectés à ce département apparaîtront ici.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const transferCurrentId = valueOf(
    transferUser,
    "departmentId",
    "DepartmentId",
    null,
  );

  const transferTargetName =
    targetDepartmentId == null ? "—" : getDepartmentName(targetDepartmentId);

  const alternativeDepartments = departments.filter(
    (department) => valueOf(department, "id", "Id") !== transferCurrentId,
  );

  return (
    <View style={[styles.container, themed.page]}>
      <View style={styles.topBar}>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, themed.text]}>
            {screenStats.departments} département
            {screenStats.departments > 1 ? "s" : ""}
          </Text>

          <Text style={[styles.subtitle, themed.secondary]}>
            {screenStats.users} membre
            {screenStats.users > 1 ? "s" : ""} · {screenStats.activeUsers} actif
            {screenStats.activeUsers > 1 ? "s" : ""}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.addButton,
            {
              backgroundColor: colors.primary,
              borderRadius: borderRadius.md,
            },
          ]}
          onPress={() => openEditor()}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un département"
        >
          <Ionicons name="add" size={20} color={colors.textOnPrimary} />
          <Text style={[styles.addText, { color: colors.textOnPrimary }]}>
            Ajouter
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={departments}
          keyExtractor={(item) => String(valueOf(item, "id", "Id"))}
          renderItem={renderDepartment}
          contentContainerStyle={[
            styles.list,
            !departments.length && styles.emptyList,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.mainEmpty}>
              <View
                style={[
                  styles.mainEmptyIcon,
                  { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <Ionicons
                  name="business-outline"
                  size={32}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={[styles.emptyTitle, themed.text]}>
                Aucun département
              </Text>
              <Text style={[styles.emptyText, themed.secondary]}>
                Ajoutez un premier département pour organiser les utilisateurs.
              </Text>
            </View>
          }
        />
      )}

      <Modal
        transparent
        visible={Boolean(actionsFor)}
        animationType="fade"
        onRequestClose={() => setActionsFor(null)}
      >
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          onPress={() => setActionsFor(null)}
        >
          <Pressable
            style={[
              styles.sheet,
              themed.card,
              { borderRadius: borderRadius.xl },
            ]}
            onPress={() => {}}
          >
            {actionsFor && (
              <>
                <Text style={[styles.modalTitle, themed.text]}>
                  {valueOf(actionsFor, "name", "Name")}
                </Text>

                <Text style={[styles.modalSubtitle, themed.secondary]}>
                  {
                    (
                      usersByDepartment[
                        String(valueOf(actionsFor, "id", "Id"))
                      ] || []
                    ).length
                  }{" "}
                  membre
                  {(
                    usersByDepartment[
                      String(valueOf(actionsFor, "id", "Id"))
                    ] || []
                  ).length > 1
                    ? "s"
                    : ""}
                </Text>
              </>
            )}

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => openEditor(actionsFor)}
            >
              <Ionicons
                name="create-outline"
                size={22}
                color={colors.textPrimary}
              />
              <Text style={[styles.actionText, themed.text]}>
                Modifier le département
              </Text>
            </TouchableOpacity>

            {actionsFor &&
            (usersByDepartment[String(valueOf(actionsFor, "id", "Id"))] || [])
              .length > 0 ? (
              <View style={[styles.actionRow, styles.disabledAction]}>
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color={colors.textSecondary}
                />
                <View style={styles.actionTextBlock}>
                  <Text style={[styles.actionText, themed.secondary]}>
                    Supprimer le département
                  </Text>
                  <Text style={[styles.actionHint, themed.secondary]}>
                    Réaffectez les membres avant la suppression.
                  </Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => requestDelete(actionsFor)}
              >
                <Ionicons name="trash-outline" size={22} color={colors.error} />
                <Text style={[styles.actionText, { color: colors.error }]}>
                  Supprimer le département
                </Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={Boolean(editor)}
        animationType="fade"
        onRequestClose={closeEditor}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View
            style={[
              styles.sheet,
              themed.card,
              { borderRadius: borderRadius.xl },
            ]}
          >
            <Text style={[styles.modalTitle, themed.text]}>
              {valueOf(editor, "id", "Id", null) == null
                ? "Ajouter un département"
                : "Modifier le département"}
            </Text>

            <Text style={[styles.label, themed.secondary]}>Nom</Text>

            <TextInput
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={100}
              editable={!saving}
              placeholder="Nom du département"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.input,
                themed.input,
                { borderRadius: borderRadius.md },
              ]}
              onSubmitEditing={saveDepartment}
              returnKeyType="done"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={closeEditor}
                disabled={saving}
              >
                <Text style={[styles.buttonText, themed.text]}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={saveDepartment}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text
                    style={[styles.buttonText, { color: colors.textOnPrimary }]}
                  >
                    Enregistrer
                  </Text>
                )}
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
              {
                borderTopLeftRadius: borderRadius.xl,
                borderTopRightRadius: borderRadius.xl,
              },
            ]}
            onPress={() => {}}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: colors.border }]}
            />

            <Text style={[styles.modalTitle, themed.text]}>
              Changer le département
            </Text>

            <View style={styles.transferHeader}>
              <View
                style={[
                  styles.avatarLarge,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Text
                  style={[
                    styles.avatarLargeText,
                    { color: colors.primaryDark },
                  ]}
                >
                  {getInitials(getFullName(transferUser))}
                </Text>
              </View>

              <View style={styles.transferIdentity}>
                <Text
                  style={[styles.transferName, themed.text]}
                  numberOfLines={1}
                >
                  {getFullName(transferUser)}
                </Text>
                <Text
                  style={[styles.transferEmail, themed.secondary]}
                  numberOfLines={1}
                >
                  {valueOf(transferUser, "email", "Email", "—")}
                </Text>
              </View>
            </View>

            <View style={styles.transferPath}>
              <View
                style={[
                  styles.transferPill,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.transferPillLabel, themed.secondary]}>
                  Actuel
                </Text>
                <Text
                  style={[styles.transferPillText, themed.text]}
                  numberOfLines={1}
                >
                  {valueOf(
                    transferUser,
                    "departmentName",
                    "DepartmentName",
                    "—",
                  )}
                </Text>
              </View>

              <Ionicons
                name="arrow-forward"
                size={20}
                color={colors.textSecondary}
              />

              <View
                style={[
                  styles.transferPill,
                  {
                    backgroundColor: colors.primaryLight,
                    borderColor: colors.primaryLight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.transferPillLabel,
                    { color: colors.primaryDark },
                  ]}
                >
                  Nouveau
                </Text>
                <Text
                  style={[
                    styles.transferPillText,
                    { color: colors.primaryDark },
                  ]}
                  numberOfLines={1}
                >
                  {transferTargetName}
                </Text>
              </View>
            </View>

            <Text style={[styles.label, themed.secondary]}>
              Nouveau département
            </Text>

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
                enabled={!transferring && alternativeDepartments.length > 0}
                style={{ color: colors.textPrimary }}
                dropdownIconColor={colors.textPrimary}
                itemStyle={
                  Platform.OS === "ios"
                    ? { color: colors.textPrimary }
                    : undefined
                }
              >
                {alternativeDepartments.length ? (
                  alternativeDepartments.map((department) => {
                    const id = valueOf(department, "id", "Id");

                    return (
                      <Picker.Item
                        key={String(id)}
                        label={valueOf(department, "name", "Name")}
                        value={id}
                        color={colors.textPrimary}
                      />
                    );
                  })
                ) : (
                  <Picker.Item
                    label="Aucun autre département"
                    value={null}
                    color={colors.textSecondary}
                  />
                )}
              </Picker>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
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
                      targetDepartmentId == null ||
                      targetDepartmentId === transferCurrentId
                        ? colors.border
                        : colors.primary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={saveTransfer}
                disabled={
                  transferring ||
                  targetDepartmentId == null ||
                  targetDepartmentId === transferCurrentId
                }
              >
                {transferring ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text
                    style={[styles.buttonText, { color: colors.textOnPrimary }]}
                  >
                    Enregistrer
                  </Text>
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
  container: {
    flex: 1,
  },

  topBar: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  titleBlock: {
    flex: 1,
  },

  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },

  addButton: {
    height: 42,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  addText: {
    fontSize: 14,
    fontWeight: "600",
  },

  list: {
    padding: 16,
    paddingTop: 6,
    paddingBottom: 90,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    borderWidth: 1,
    overflow: "hidden",
  },

  cardHeader: {
    minHeight: 80,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  departmentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  departmentInfo: {
    flex: 1,
  },

  departmentName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 3,
  },

  count: {
    fontSize: 13,
  },

  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
    gap: 7,
  },

  breakdownText: {
    fontSize: 12,
  },

  breakdownDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  expandHint: {
    minWidth: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },

  expandText: {
    fontSize: 12,
    fontWeight: "700",
  },

  expanded: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  avatarText: {
    fontSize: 12,
    fontWeight: "800",
  },

  userInfo: {
    flex: 1,
  },

  userName: {
    fontSize: 14,
    fontWeight: "700",
  },

  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
    gap: 10,
  },

  role: {
    fontSize: 12,
  },

  status: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  moveButton: {
    height: 36,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginLeft: 8,
  },

  moveText: {
    fontSize: 12,
    fontWeight: "700",
  },

  emptyDepartment: {
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 16,
  },

  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  mainEmpty: {
    alignItems: "center",
    paddingHorizontal: 26,
  },

  mainEmptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  emptyText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },

  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 22,
  },

  sheet: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    borderWidth: 1,
    padding: 18,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },

  modalSubtitle: {
    fontSize: 13,
    marginBottom: 10,
  },

  actionRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  disabledAction: {
    opacity: 0.75,
  },

  actionTextBlock: {
    flex: 1,
  },

  actionText: {
    fontSize: 15,
    fontWeight: "600",
  },

  actionHint: {
    fontSize: 12,
    marginTop: 3,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 7,
  },

  input: {
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 13,
    fontSize: 15,
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },

  secondaryButton: {
    minWidth: 100,
    height: 44,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  saveButton: {
    minWidth: 110,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },

  bottomOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  bottomSheet: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderWidth: 1,
    padding: 20,
    paddingBottom: 28,
  },

  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
  },

  transferHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 18,
  },

  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarLargeText: {
    fontSize: 15,
    fontWeight: "800",
  },

  transferIdentity: {
    flex: 1,
  },

  transferName: {
    fontSize: 16,
    fontWeight: "700",
  },

  transferEmail: {
    fontSize: 13,
    marginTop: 3,
  },

  transferPath: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },

  transferPill: {
    flex: 1,
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },

  transferPillLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },

  transferPillText: {
    fontSize: 14,
    fontWeight: "700",
  },

  pickerWrapper: {
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 2,
  },
});
