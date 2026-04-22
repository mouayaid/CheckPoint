import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { adminTableService, adminSeatService } from "../../services/api/adminSeatService";

// ─── helpers ─────────────────────────────────────────────────────────────────
const extract = (res) => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return res?.data?.data ?? res?.data ?? null;
};

const emptyTable = { name: "", width: "2", height: "2" };
const emptySeat  = { label: "", isActive: true };

// ─── Small sub-components ────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, icon, action }) {
  const { colors, spacing, typography, borderRadius } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{
          width: 36, height: 36, borderRadius: borderRadius.md,
          backgroundColor: colors.primaryLight + "30",
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View>
          <Text style={{ fontSize: typography.base, fontFamily: typography.fontFamily?.bold, color: colors.text }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>{subtitle}</Text> : null}
        </View>
      </View>
      {action}
    </View>
  );
}

function AddButton({ onPress, label }) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
      }}
    >
      <Ionicons name="add" size={16} color="#fff" />
      <Text style={{ color: "#fff", fontSize: typography.sm, fontFamily: typography.fontFamily?.semibold }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Table Card ──────────────────────────────────────────────────────────────

function TableCard({ table, onSelect, onEdit, onDelete, selected }) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const pulse = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => { pulse(); onSelect(table); }}
        style={[{
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 2,
          borderColor: selected ? colors.primary : colors.border,
          ...shadows.sm,
        }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* icon */}
          <View style={{
            width: 44, height: 44, borderRadius: borderRadius.md,
            backgroundColor: selected ? colors.primary : colors.surfaceMuted,
            alignItems: "center", justifyContent: "center",
            marginRight: spacing.md,
          }}>
            <Ionicons
              name={selected ? "grid" : "grid-outline"}
              size={22}
              color={selected ? "#fff" : colors.textSecondary}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: typography.base, fontFamily: typography.fontFamily?.bold, color: colors.text }}>
              {table.name}
            </Text>
            <Text style={{ fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 }}>
              {table.seatCount ?? 0} siège{(table.seatCount ?? 0) !== 1 ? "s" : ""} · {table.width}×{table.height}
            </Text>
          </View>

          {/* actions */}
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            <TouchableOpacity
              onPress={() => onEdit(table)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 32, height: 32, borderRadius: borderRadius.full,
                backgroundColor: colors.surfaceMuted,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="pencil-outline" size={15} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onDelete(table)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 32, height: 32, borderRadius: borderRadius.full,
                backgroundColor: colors.errorLight,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="trash-outline" size={15} color={colors.error} />
            </TouchableOpacity>

            <View style={{
              width: 32, height: 32, borderRadius: borderRadius.full,
              backgroundColor: selected ? colors.primary + "20" : colors.surfaceMuted,
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons
                name={selected ? "chevron-down" : "chevron-forward"}
                size={16}
                color={selected ? colors.primary : colors.textSecondary}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Seat Row ────────────────────────────────────────────────────────────────

function SeatRow({ seat, onEdit, onDelete }) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  return (
    <View style={{
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      marginBottom: spacing.xs,
      borderWidth: 1, borderColor: colors.border,
    }}>
      <View style={{
        width: 32, height: 32, borderRadius: borderRadius.full,
        backgroundColor: seat.isActive ? colors.successLight : colors.errorLight,
        alignItems: "center", justifyContent: "center",
        marginRight: spacing.sm,
      }}>
        <Ionicons
          name="desktop-outline"
          size={15}
          color={seat.isActive ? colors.success : colors.error}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: typography.sm, fontFamily: typography.fontFamily?.semibold, color: colors.text }}>
          {seat.label || `Siège #${seat.id}`}
        </Text>
        <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
          {seat.isActive ? "Actif" : "Désactivé"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        <TouchableOpacity
          onPress={() => onEdit(seat)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 30, height: 30, borderRadius: borderRadius.full,
            backgroundColor: colors.surfaceMuted,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(seat)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 30, height: 30, borderRadius: borderRadius.full,
            backgroundColor: colors.errorLight,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="trash-outline" size={14} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Modal form ──────────────────────────────────────────────────────────────

function FormModal({ visible, title, fields, values, onChange, onSave, onClose, saving }) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1, justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.45)",
      }}>
        <View style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: spacing.xl, paddingBottom: spacing.xxxl,
          ...shadows.lg,
        }}>
          {/* drag handle */}
          <View style={{
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.xl,
          }} />

          <Text style={{
            fontSize: typography.lg, fontFamily: typography.fontFamily?.bold,
            color: colors.text, marginBottom: spacing.xl,
          }}>
            {title}
          </Text>

          {fields.map((f) => (
            <View key={f.key} style={{ marginBottom: spacing.md }}>
              <Text style={{
                fontSize: typography.xs, fontFamily: typography.fontFamily?.semibold,
                color: colors.textSecondary, marginBottom: spacing.xs, textTransform: "uppercase", letterSpacing: 0.5,
              }}>
                {f.label}
              </Text>

              {f.type === "switch" ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  backgroundColor: colors.surfaceMuted, borderRadius: borderRadius.md,
                  paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                  <Text style={{ color: colors.text, fontSize: typography.sm }}>
                    {values[f.key] ? "Actif" : "Désactivé"}
                  </Text>
                  <Switch
                    value={!!values[f.key]}
                    onValueChange={(v) => onChange(f.key, v)}
                    trackColor={{ false: colors.border, true: colors.primary + "80" }}
                    thumbColor={values[f.key] ? colors.primary : colors.textSecondary}
                  />
                </View>
              ) : (
                <TextInput
                  value={String(values[f.key] ?? "")}
                  onChangeText={(v) => onChange(f.key, v)}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType={f.numeric ? "numeric" : "default"}
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
                    fontSize: typography.sm, color: colors.text,
                    borderWidth: 1, borderColor: colors.border,
                  }}
                />
              )}
            </View>
          ))}

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1, alignItems: "center", paddingVertical: spacing.md,
                borderRadius: borderRadius.md,
                backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontFamily: typography.fontFamily?.semibold }}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSave}
              disabled={saving}
              style={{
                flex: 2, alignItems: "center", paddingVertical: spacing.md,
                borderRadius: borderRadius.md,
                backgroundColor: colors.primary,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: "#fff", fontFamily: typography.fontFamily?.bold }}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ManageSeatsScreen() {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  // Data
  const [tables, setTables]           = useState([]);
  const [seats,  setSeats]            = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);

  // Loading
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingSeats,  setLoadingSeats]  = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);

  // Table modal
  const [tableModal, setTableModal]   = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [tableForm, setTableForm]     = useState(emptyTable);
  const [savingTable, setSavingTable] = useState(false);

  // Seat modal
  const [seatModal, setSeatModal]     = useState(false);
  const [editingSeat, setEditingSeat] = useState(null);
  const [seatForm, setSeatForm]       = useState(emptySeat);
  const [savingSeat, setSavingSeat]   = useState(false);

  // ── loaders ──────────────────────────────────────────────────────────────

  const loadTables = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoadingTables(true);
      const res = await adminTableService.getAll();
      const data = extract(res);
      setTables(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert("Erreur", "Impossible de charger les tables.");
    } finally {
      setLoadingTables(false);
      setRefreshing(false);
    }
  }, []);

  const loadSeats = useCallback(async (tableId) => {
    try {
      setLoadingSeats(true);
      const res = await adminSeatService.getByTable(tableId);
      const data = extract(res);
      setSeats(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert("Erreur", "Impossible de charger les sièges.");
      setSeats([]);
    } finally {
      setLoadingSeats(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadTables(); }, [loadTables]));

  // ── table selection ───────────────────────────────────────────────────────

  const handleSelectTable = useCallback((table) => {
    if (selectedTable?.id === table.id) {
      setSelectedTable(null);
      setSeats([]);
    } else {
      setSelectedTable(table);
      loadSeats(table.id);
    }
  }, [selectedTable, loadSeats]);

  // ── table CRUD ────────────────────────────────────────────────────────────

  const openAddTable = () => {
    setEditingTable(null);
    setTableForm(emptyTable);
    setTableModal(true);
  };

  const openEditTable = (table) => {
    setEditingTable(table);
    setTableForm({ name: table.name, width: String(table.width), height: String(table.height) });
    setTableModal(true);
  };

  const saveTable = async () => {
    const name = tableForm.name.trim();
    const width  = parseInt(tableForm.width, 10);
    const height = parseInt(tableForm.height, 10);

    if (!name)            return Alert.alert("Validation", "Le nom est requis.");
    if (isNaN(width)  || width  < 1) return Alert.alert("Validation", "Largeur invalide.");
    if (isNaN(height) || height < 1) return Alert.alert("Validation", "Hauteur invalide.");

    try {
      setSavingTable(true);
      const dto = { name, positionX: 0, positionY: 0, width, height };
      if (editingTable) {
        await adminTableService.update(editingTable.id, dto);
      } else {
        await adminTableService.create(dto);
      }
      setTableModal(false);
      await loadTables();
      // refresh seats if the edited table is currently selected
      if (editingTable && selectedTable?.id === editingTable.id) {
        setSelectedTable((t) => ({ ...t, ...dto }));
      }
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder la table.");
    } finally {
      setSavingTable(false);
    }
  };

  const confirmDeleteTable = (table) => {
    Alert.alert(
      "Supprimer la table",
      `Voulez-vous vraiment supprimer « ${table.name} » et tous ses sièges ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            try {
              await adminTableService.delete(table.id);
              if (selectedTable?.id === table.id) {
                setSelectedTable(null);
                setSeats([]);
              }
              await loadTables();
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer la table.");
            }
          },
        },
      ]
    );
  };

  // ── seat CRUD ─────────────────────────────────────────────────────────────

  const openAddSeat = () => {
    setEditingSeat(null);
    setSeatForm(emptySeat);
    setSeatModal(true);
  };

  const openEditSeat = (seat) => {
    setEditingSeat(seat);
    setSeatForm({ label: seat.label, isActive: seat.isActive });
    setSeatModal(true);
  };

  const saveSeat = async () => {
    const label = seatForm.label.trim();
    if (!label) return Alert.alert("Validation", "L'étiquette est requise.");

    try {
      setSavingSeat(true);
      if (editingSeat) {
        await adminSeatService.updateSeat(editingSeat.id, {
          label,
          positionX: editingSeat.positionX,
          positionY: editingSeat.positionY,
          isActive: seatForm.isActive,
        });
      } else {
        await adminSeatService.createSeat({
          officeTableId: selectedTable.id,
          label,
          positionX: 0,
          positionY: 0,
          isActive: true,
        });
      }
      setSeatModal(false);
      await loadSeats(selectedTable.id);
      // update seat count badge on the table card
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTable.id
            ? { ...t, seatCount: editingSeat ? t.seatCount : (t.seatCount ?? 0) + 1 }
            : t
        )
      );
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder le siège.");
    } finally {
      setSavingSeat(false);
    }
  };

  const confirmDeleteSeat = (seat) => {
    Alert.alert(
      "Supprimer le siège",
      `Supprimer « ${seat.label || `Siège #${seat.id}`} » ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            try {
              await adminSeatService.deleteSeat(seat.id);
              await loadSeats(selectedTable.id);
              setTables((prev) =>
                prev.map((t) =>
                  t.id === selectedTable.id
                    ? { ...t, seatCount: Math.max(0, (t.seatCount ?? 1) - 1) }
                    : t
                )
              );
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer le siège.");
            }
          },
        },
      ]
    );
  };

  // ── render ────────────────────────────────────────────────────────────────

  const tableFields = [
    { key: "name",   label: "Nom de la table", placeholder: "ex. Table A" },
    { key: "width",  label: "Largeur (colonnes)", placeholder: "ex. 3", numeric: true },
    { key: "height", label: "Hauteur (rangées)",  placeholder: "ex. 2", numeric: true },
  ];

  const seatFields = [
    { key: "label",    label: "Étiquette du siège", placeholder: "ex. A1" },
    { key: "isActive", label: "Statut",              type: "switch" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTables(true)}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Tables section ── */}
        <SectionHeader
          title="Tables de bureau"
          subtitle={`${tables.length} table${tables.length !== 1 ? "s" : ""}`}
          icon="grid-outline"
          action={<AddButton onPress={openAddTable} label="Ajouter" />}
        />

        {loadingTables ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: typography.sm }}>
              Chargement des tables…
            </Text>
          </View>
        ) : tables.length === 0 ? (
          <View style={{
            alignItems: "center", paddingVertical: 40,
            backgroundColor: colors.surface, borderRadius: borderRadius.lg,
            borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
            marginBottom: spacing.xl,
          }}>
            <View style={{
              width: 56, height: 56, borderRadius: borderRadius.full,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
            }}>
              <Ionicons name="grid-outline" size={26} color={colors.textSecondary} />
            </View>
            <Text style={{ fontSize: typography.base, fontFamily: typography.fontFamily?.semibold, color: colors.text }}>
              Aucune table créée
            </Text>
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 4 }}>
              Appuyez sur « Ajouter » pour commencer.
            </Text>
          </View>
        ) : (
          tables.map((table) => {
            const isSelected = selectedTable?.id === table.id;
            return (
              <View key={table.id}>
                <TableCard
                  table={table}
                  selected={isSelected}
                  onSelect={handleSelectTable}
                  onEdit={openEditTable}
                  onDelete={confirmDeleteTable}
                />

                {/* ── Seats panel (drill-down) ── */}
                {isSelected && (
                  <View style={{
                    marginLeft: spacing.lg,
                    marginBottom: spacing.md,
                    borderLeftWidth: 2,
                    borderLeftColor: colors.primary + "40",
                    paddingLeft: spacing.lg,
                  }}>
                    <SectionHeader
                      title="Sièges"
                      subtitle={`${seats.length} siège${seats.length !== 1 ? "s" : ""} dans cette table`}
                      icon="desktop-outline"
                      action={<AddButton onPress={openAddSeat} label="Ajouter" />}
                    />

                    {loadingSeats ? (
                      <View style={{ alignItems: "center", paddingVertical: 24 }}>
                        <ActivityIndicator color={colors.primary} />
                      </View>
                    ) : seats.length === 0 ? (
                      <View style={{
                        alignItems: "center", paddingVertical: 28,
                        backgroundColor: colors.surfaceMuted,
                        borderRadius: borderRadius.md,
                        borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
                        marginBottom: spacing.sm,
                      }}>
                        <Ionicons name="desktop-outline" size={22} color={colors.textSecondary} />
                        <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 6 }}>
                          Aucun siège dans cette table
                        </Text>
                      </View>
                    ) : (
                      seats.map((seat) => (
                        <SeatRow
                          key={seat.id}
                          seat={seat}
                          onEdit={openEditSeat}
                          onDelete={confirmDeleteSeat}
                        />
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Table modal ── */}
      <FormModal
        visible={tableModal}
        title={editingTable ? "Modifier la table" : "Nouvelle table"}
        fields={tableFields}
        values={tableForm}
        onChange={(key, val) => setTableForm((f) => ({ ...f, [key]: val }))}
        onSave={saveTable}
        onClose={() => setTableModal(false)}
        saving={savingTable}
      />

      {/* ── Seat modal ── */}
      <FormModal
        visible={seatModal}
        title={editingSeat ? "Modifier le siège" : "Nouveau siège"}
        fields={seatFields}
        values={seatForm}
        onChange={(key, val) => setSeatForm((f) => ({ ...f, [key]: val }))}
        onSave={saveSeat}
        onClose={() => setSeatModal(false)}
        saving={savingSeat}
      />
    </View>
  );
}
