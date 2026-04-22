import React, { useCallback, useMemo, useState } from "react";
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
  LayoutAnimation,
  UIManager,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { adminSeatService } from "../../services/api/adminSeatService";
import { adminOfficeTableService } from "../../services/api/adminOfficeTableService";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ══════════════════════════════════
   Mini Table Preview
══════════════════════════════════ */
const TableMiniPreview = ({ table, seats = [], colors, spacing, borderRadius }) => {
  const previewWidth = 260;
  const previewHeight = 130;

  const tableWidth = Math.max(60, Number(table?.width ?? table?.Width ?? 100));
  const tableHeight = Math.max(40, Number(table?.height ?? table?.Height ?? 100));

  const normalizedTable = {
    left: 86,
    top: 43,
    width: Math.min(Math.max(tableWidth * 0.5, 72), 110),
    height: Math.min(Math.max(tableHeight * 0.35, 42), 55),
  };

  const seatSize = 10;
  const gap = 7;

  const distributedSeats = seats.map((seat, index) => {
    const perSide = Math.ceil(seats.length / 4) || 1;
    const side = Math.floor(index / perSide);
    const offsetIndex = index % perSide;
    let left = 0, top = 0;
    if (side === 0) { left = normalizedTable.left - 16 + offsetIndex * (seatSize + gap); top = normalizedTable.top - 16; }
    else if (side === 1) { left = normalizedTable.left + normalizedTable.width + 10; top = normalizedTable.top + offsetIndex * (seatSize + gap); }
    else if (side === 2) { left = normalizedTable.left - 16 + offsetIndex * (seatSize + gap); top = normalizedTable.top + normalizedTable.height + 10; }
    else { left = normalizedTable.left - 16; top = normalizedTable.top + offsetIndex * (seatSize + gap); }
    return { seat, left: Math.max(6, Math.min(left, previewWidth - 16)), top: Math.max(6, Math.min(top, previewHeight - 16)) };
  });

  return (
    <View
      style={{
        backgroundColor: colors.surfaceMuted,
        borderRadius: borderRadius.md,
        overflow: "hidden",
        marginBottom: spacing.md,
      }}
    >
      <View style={{ width: previewWidth, height: previewHeight, alignSelf: "center", position: "relative" }}>
        <View
          style={{
            position: "absolute",
            left: normalizedTable.left,
            top: normalizedTable.top,
            width: normalizedTable.width,
            height: normalizedTable.height,
            backgroundColor: colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 9, color: colors.textSecondary, fontWeight: "600" }}>
            {table?.name ?? table?.Name ?? "Table"}
          </Text>
        </View>

        {distributedSeats.map(({ seat, left, top }, index) => {
          const isActive = seat?.isActive ?? seat?.IsActive ?? false;
          return (
            <View
              key={`preview-seat-${seat?.id ?? seat?.Id ?? index}`}
              style={{
                position: "absolute",
                left,
                top,
                width: seatSize,
                height: seatSize,
                borderRadius: seatSize / 2,
                backgroundColor: isActive ? colors.primary : "#94A3B8",
                borderWidth: 1.5,
                borderColor: colors.surfaceMuted,
              }}
            />
          );
        })}
      </View>
    </View>
  );
};

/* ══════════════════════════════════
   Seat Chip (grid item)
══════════════════════════════════ */
const SeatChip = ({ seat, tableId, onEdit, onDelete, deletingSeatId, colors, spacing, borderRadius, typography }) => {
  const id = seat.id ?? seat.Id;
  const label = seat.label ?? seat.Label ?? "—";
  const isActive = seat.isActive ?? seat.IsActive ?? false;
  const isDeleting = deletingSeatId === id;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: isActive ? colors.border : `${colors.border}80`,
        borderStyle: isActive ? "solid" : "dashed",
        borderRadius: borderRadius.md,
        padding: 10,
        opacity: isActive ? 1 : 0.65,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: isActive ? colors.primary : "#94A3B8",
            marginRight: 6,
          }}
        />
        <Text
          style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.text, flex: 1 }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>

      <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 8 }}>
        {isActive ? "Actif" : "Inactif"}
      </Text>

      <View style={{ flexDirection: "row", gap: 6 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            alignItems: "center",
            paddingVertical: 5,
            borderRadius: 6,
            backgroundColor: colors.surfaceMuted,
          }}
          onPress={() => onEdit(seat, tableId)}
        >
          <Ionicons name="create-outline" size={13} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            alignItems: "center",
            paddingVertical: 5,
            borderRadius: 6,
            backgroundColor: "#FEF2F2",
          }}
          onPress={() => onDelete(seat, tableId)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Ionicons name="trash-outline" size={13} color="#EF4444" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ══════════════════════════════════
   Stats Banner
══════════════════════════════════ */
const StatsBanner = ({ tables, seatsByTableId, colors, spacing, borderRadius, typography }) => {
  const totalSeats = Object.values(seatsByTableId).flat().length;
  const activeSeats = Object.values(seatsByTableId).flat().filter((s) => s.isActive ?? s.IsActive).length;
  const inactiveSeats = totalSeats - activeSeats;

  const stats = [
    { label: "Tables", value: tables.length, icon: "grid-outline" },
    { label: "Sièges actifs", value: activeSeats, icon: "checkmark-circle-outline", color: colors.primary },
    { label: "Inactifs", value: inactiveSeats, icon: "close-circle-outline", color: "#94A3B8" },
  ];

  return (
    <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
          }}
        >
          <Ionicons
            name={stat.icon}
            size={16}
            color={stat.color ?? colors.textSecondary}
            style={{ marginBottom: 6 }}
          />
          <Text style={{ fontSize: 20, fontWeight: typography.bold, color: colors.text }}>{stat.value}</Text>
          <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
};

/* ══════════════════════════════════
   Occupancy Bar
══════════════════════════════════ */
const OccupancyBar = ({ seats, colors, typography }) => {
  const total = seats.length;
  const active = seats.filter((s) => s.isActive ?? s.IsActive).length;
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  const color = pct >= 75 ? colors.primary : pct >= 40 ? "#F59E0B" : "#94A3B8";

  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 10, color: colors.textSecondary }}>Occupation</Text>
        <Text style={{ fontSize: 10, fontWeight: "600", color: colors.textSecondary }}>
          {active} / {total}
        </Text>
      </View>
      <View style={{ height: 4, backgroundColor: colors.surfaceMuted, borderRadius: 99, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: 99 }} />
      </View>
    </View>
  );
};

/* ══════════════════════════════════
   Edit/Add Seat Modal
══════════════════════════════════ */
const EditSeatModal = ({
  visible,
  seat,
  defaultTableId,
  tableName,
  onClose,
  onSave,
  colors,
  spacing,
  typography,
  borderRadius,
}) => {
  const [label, setLabel] = useState("");
  const [positionX, setPositionX] = useState("0");
  const [positionY, setPositionY] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setLabel(seat?.label ?? seat?.Label ?? "");
      setPositionX(String(seat?.positionX ?? seat?.PositionX ?? "0"));
      setPositionY(String(seat?.positionY ?? seat?.PositionY ?? "0"));
      setIsActive(seat ? (seat?.isActive ?? seat?.IsActive ?? true) : true);
      setShowAdvanced(false);
    }
  }, [visible, seat, defaultTableId]);

  const handleSave = async () => {
    if (!label.trim()) {
      Alert.alert("Validation", "L'étiquette du siège est obligatoire.");
      return;
    }
    const tableId = Number(defaultTableId);
    if (isNaN(tableId) || tableId <= 0) {
      Alert.alert("Validation", "ID de table invalide.");
      return;
    }
    const posX = Number(positionX);
    const posY = Number(positionY);
    if (isNaN(posX) || isNaN(posY)) {
      Alert.alert("Validation", "Les positions X et Y doivent être numériques.");
      return;
    }
    setSaving(true);
    try {
      const baseDto = { label: label.trim(), officeTableId: tableId, positionX: posX, positionY: posY };
      const dto = seat ? { ...baseDto, isActive } : baseDto;
      await onSave(seat?.id ?? seat?.Id, dto);
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err?.response?.data?.message || "Impossible de sauvegarder le siège.");
    } finally {
      setSaving(false);
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: spacing.xl,
          paddingBottom: 36,
          maxHeight: "80%",
        },
        handle: {
          width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
          alignSelf: "center", marginBottom: spacing.lg,
        },
        title: { fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text, marginBottom: 4 },
        tableCtx: {
          flexDirection: "row", alignItems: "center", gap: 6,
          backgroundColor: colors.surfaceMuted, borderRadius: borderRadius.md,
          paddingHorizontal: 10, paddingVertical: 6, marginBottom: spacing.lg,
          alignSelf: "flex-start",
        },
        tableCtxText: { fontSize: typography.xs, color: colors.textSecondary },
        label: {
          fontSize: typography.sm, fontWeight: typography.medium,
          color: colors.textSecondary, marginBottom: 6,
        },
        input: {
          backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
          borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 12,
          fontSize: typography.base, color: colors.text, marginBottom: spacing.md,
        },
        advancedToggle: {
          flexDirection: "row", alignItems: "center", gap: 6,
          paddingVertical: 8, marginBottom: spacing.sm,
        },
        advancedText: { fontSize: typography.sm, color: colors.textSecondary },
        statusToggle: {
          flexDirection: "row", alignItems: "center", marginBottom: spacing.md,
          gap: 10, paddingVertical: 10,
        },
        statusLabel: { fontSize: typography.sm, color: colors.text, flex: 1 },
        row: { flexDirection: "row", gap: spacing.md },
        col: { flex: 1 },
        btnRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
        cancel: {
          flex: 1, alignItems: "center", justifyContent: "center",
          paddingVertical: 14, borderRadius: borderRadius.lg,
          borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
        },
        cancelTxt: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textSecondary },
        save: {
          flex: 2, alignItems: "center", justifyContent: "center",
          paddingVertical: 14, borderRadius: borderRadius.lg, backgroundColor: colors.primary,
        },
        saveTxt: { fontSize: typography.base, fontWeight: typography.semibold, color: "#fff" },
      }),
    [colors, spacing, typography, borderRadius]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.handle} />
            <Text style={s.title}>{seat ? "Modifier le siège" : "Ajouter un siège"}</Text>

            {tableName && (
              <View style={s.tableCtx}>
                <Ionicons name="grid-outline" size={12} color={colors.textSecondary} />
                <Text style={s.tableCtxText}>{tableName}</Text>
              </View>
            )}

            <Text style={s.label}>Étiquette du siège</Text>
            <TextInput
              style={s.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Ex: A1"
              placeholderTextColor={colors.placeholder}
              editable={!saving}
              autoFocus
            />

            {seat && (
              <TouchableOpacity style={s.statusToggle} onPress={() => setIsActive(!isActive)}>
                <Ionicons
                  name={isActive ? "checkbox" : "square-outline"}
                  size={22}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
                <Text style={s.statusLabel}>Siège actif</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)}>
              <Ionicons
                name={showAdvanced ? "chevron-down-outline" : "chevron-forward-outline"}
                size={14}
                color={colors.textSecondary}
              />
              <Text style={s.advancedText}>Paramètres avancés (coordonnées)</Text>
            </TouchableOpacity>

            {showAdvanced && (
              <View style={s.row}>
                <View style={s.col}>
                  <Text style={s.label}>Position X</Text>
                  <TextInput
                    style={s.input}
                    value={positionX}
                    onChangeText={setPositionX}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    editable={!saving}
                  />
                </View>
                <View style={s.col}>
                  <Text style={s.label}>Position Y</Text>
                  <TextInput
                    style={s.input}
                    value={positionY}
                    onChangeText={setPositionY}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    editable={!saving}
                  />
                </View>
              </View>
            )}

            <View style={s.btnRow}>
              <TouchableOpacity style={s.cancel} onPress={onClose} disabled={saving}>
                <Text style={s.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.save} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ══════════════════════════════════
   Edit/Add Table Modal
══════════════════════════════════ */
const EditTableModal = ({
  visible,
  table,
  onClose,
  onSave,
  colors,
  spacing,
  typography,
  borderRadius,
}) => {
  const [name, setName] = useState("");
  const [positionX, setPositionX] = useState("0");
  const [positionY, setPositionY] = useState("0");
  const [width, setWidth] = useState("100");
  const [height, setHeight] = useState("100");
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName(table?.name ?? table?.Name ?? "");
      setPositionX(String(table?.positionX ?? table?.PositionX ?? "0"));
      setPositionY(String(table?.positionY ?? table?.PositionY ?? "0"));
      setWidth(String(table?.width ?? table?.Width ?? "100"));
      setHeight(String(table?.height ?? table?.Height ?? "100"));
      setShowAdvanced(false);
    }
  }, [visible, table]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Le nom de la table est obligatoire.");
      return;
    }
    setSaving(true);
    try {
      const dto = {
        name: name.trim(),
        positionX: Number(positionX) || 0,
        positionY: Number(positionY) || 0,
        width: Number(width) || 100,
        height: Number(height) || 100,
      };
      await onSave(table?.id ?? table?.Id, dto);
      onClose();
    } catch (err) {
      Alert.alert("Erreur", err?.response?.data?.message || "Impossible de sauvegarder la table.");
    } finally {
      setSaving(false);
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: spacing.xl,
          paddingBottom: 36,
          maxHeight: "80%",
        },
        handle: {
          width: 40, height: 4, borderRadius: 2,
          backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg,
        },
        title: { fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text, marginBottom: spacing.lg },
        label: {
          fontSize: typography.sm, fontWeight: typography.medium,
          color: colors.textSecondary, marginBottom: 6,
        },
        input: {
          backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
          borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 12,
          fontSize: typography.base, color: colors.text, marginBottom: spacing.md,
        },
        advancedToggle: {
          flexDirection: "row", alignItems: "center", gap: 6,
          paddingVertical: 8, marginBottom: spacing.sm,
        },
        advancedText: { fontSize: typography.sm, color: colors.textSecondary },
        row: { flexDirection: "row", gap: spacing.md },
        col: { flex: 1 },
        btnRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
        cancel: {
          flex: 1, alignItems: "center", justifyContent: "center",
          paddingVertical: 14, borderRadius: borderRadius.lg,
          borderWidth: 1.5, borderColor: colors.border,
        },
        cancelTxt: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textSecondary },
        save: {
          flex: 2, alignItems: "center", justifyContent: "center",
          paddingVertical: 14, borderRadius: borderRadius.lg, backgroundColor: colors.primary,
        },
        saveTxt: { fontSize: typography.base, fontWeight: typography.semibold, color: "#fff" },
      }),
    [colors, spacing, typography, borderRadius]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.handle} />
            <Text style={s.title}>{table ? "Modifier la table" : "Ajouter une table"}</Text>

            <Text style={s.label}>Nom de la table</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Table A — Espace ouvert"
              placeholderTextColor={colors.placeholder}
              editable={!saving}
              autoFocus
            />

            <TouchableOpacity style={s.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)}>
              <Ionicons
                name={showAdvanced ? "chevron-down-outline" : "chevron-forward-outline"}
                size={14}
                color={colors.textSecondary}
              />
              <Text style={s.advancedText}>Paramètres avancés (position & dimensions)</Text>
            </TouchableOpacity>

            {showAdvanced && (
              <>
                <View style={s.row}>
                  <View style={s.col}>
                    <Text style={s.label}>Position X</Text>
                    <TextInput
                      style={s.input}
                      value={positionX}
                      onChangeText={setPositionX}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.placeholder}
                      editable={!saving}
                    />
                  </View>
                  <View style={s.col}>
                    <Text style={s.label}>Position Y</Text>
                    <TextInput
                      style={s.input}
                      value={positionY}
                      onChangeText={setPositionY}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.placeholder}
                      editable={!saving}
                    />
                  </View>
                </View>
                <View style={s.row}>
                  <View style={s.col}>
                    <Text style={s.label}>Largeur</Text>
                    <TextInput
                      style={s.input}
                      value={width}
                      onChangeText={setWidth}
                      keyboardType="numeric"
                      placeholder="100"
                      placeholderTextColor={colors.placeholder}
                      editable={!saving}
                    />
                  </View>
                  <View style={s.col}>
                    <Text style={s.label}>Hauteur</Text>
                    <TextInput
                      style={s.input}
                      value={height}
                      onChangeText={setHeight}
                      keyboardType="numeric"
                      placeholder="100"
                      placeholderTextColor={colors.placeholder}
                      editable={!saving}
                    />
                  </View>
                </View>
              </>
            )}

            <View style={s.btnRow}>
              <TouchableOpacity style={s.cancel} onPress={onClose} disabled={saving}>
                <Text style={s.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.save} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ══════════════════════════════════
   Main Screen
══════════════════════════════════ */
const SeatManagementScreen = () => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows]
  );

  const [tables, setTables] = useState([]);
  const [seatsByTableId, setSeatsByTableId] = useState({});
  const [loadingSeatsForTable, setLoadingSeatsForTable] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editSeat, setEditSeat] = useState(null);
  const [isSeatModalVisible, setSeatModalVisible] = useState(false);
  const [defaultTableIdForSeat, setDefaultTableIdForSeat] = useState(null);

  const [editTable, setEditTable] = useState(null);
  const [isTableModalVisible, setTableModalVisible] = useState(false);

  const [deletingSeatId, setDeletingSeatId] = useState(null);
  const [deletingTableId, setDeletingTableId] = useState(null);
  const [expandedTableIds, setExpandedTableIds] = useState(new Set());

  const getTableSeats = (tableId) => seatsByTableId[tableId] ?? [];

  const getTableName = (tableId) => {
    const t = tables.find((t) => (t.id ?? t.Id) === tableId);
    return t?.name ?? t?.Name ?? "";
  };

  const getCapacityBadge = (seats) => {
    const total = seats.length;
    if (total === 0) return null;
    const pct = seats.filter((s) => s.isActive ?? s.IsActive).length / total;
    if (pct >= 0.75) return { label: "Bonne capacité", bg: "#DCFCE7", text: "#166534" };
    if (pct >= 0.4) return { label: "Capacité moyenne", bg: "#FEF9C3", text: "#854D0E" };
    return { label: "Faible", bg: "#F1F5F9", text: "#475569" };
  };

  const loadSeatsForTable = useCallback(async (tableId) => {
    setLoadingSeatsForTable((prev) => ({ ...prev, [tableId]: true }));
    try {
      const res = await adminSeatService.getByTable(tableId);
      const data = adminSeatService.extractData(res) || [];
      setSeatsByTableId((prev) => ({ ...prev, [tableId]: data }));
    } catch {
      Alert.alert("Erreur", "Impossible de charger les sièges.");
    } finally {
      setLoadingSeatsForTable((prev) => ({ ...prev, [tableId]: false }));
    }
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const tablesRes = await adminOfficeTableService.getAllOfficeTables();
      const tableList = adminOfficeTableService.extractData(tablesRes) || [];
      setTables(tableList);
      if (isRefresh) setSeatsByTableId({});
    } catch {
      Alert.alert("Erreur", "Impossible de charger les tables.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const toggleTable = (tableId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newSet = new Set(expandedTableIds);
    if (newSet.has(tableId)) {
      newSet.delete(tableId);
    } else {
      newSet.add(tableId);
      if (!seatsByTableId[tableId]) loadSeatsForTable(tableId);
    }
    setExpandedTableIds(newSet);
  };

  const handleSaveTable = async (id, dto) => {
    if (id) {
      const res = await adminOfficeTableService.updateOfficeTable(id, dto);
      const updated = adminOfficeTableService.extractData(res);
      setTables((prev) => prev.map((t) => ((t.id ?? t.Id) === id ? { ...t, ...updated } : t)));
    } else {
      const res = await adminOfficeTableService.createOfficeTable(dto);
      const created = adminOfficeTableService.extractData(res);
      setTables((prev) => [...prev, created]);
    }
  };

  const handleDeleteTable = (table) => {
    const id = table.id ?? table.Id;
    const name = table.name ?? table.Name;
    Alert.alert(
      "Supprimer la table",
      `Supprimer "${name}" et tous ses sièges ? Cette action est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setDeletingTableId(id);
            try {
              await adminOfficeTableService.deleteOfficeTable(id);
              setTables((prev) => prev.filter((t) => (t.id ?? t.Id) !== id));
              setSeatsByTableId((prev) => { const next = { ...prev }; delete next[id]; return next; });
              setExpandedTableIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer la table.");
            } finally {
              setDeletingTableId(null);
            }
          },
        },
      ]
    );
  };

  const handleSaveSeat = async (id, dto) => {
    const tableId = dto.officeTableId ?? defaultTableIdForSeat;
    if (id) {
      const res = await adminSeatService.updateSeat(id, dto);
      const updated = adminSeatService.extractData(res);
      setSeatsByTableId((prev) => ({
        ...prev,
        [tableId]: (prev[tableId] ?? []).map((s) => ((s.id ?? s.Id) === id ? { ...s, ...updated } : s)),
      }));
    } else {
      const res = await adminSeatService.createSeat(dto);
      const created = adminSeatService.extractData(res);
      setSeatsByTableId((prev) => ({ ...prev, [tableId]: [...(prev[tableId] ?? []), created] }));
    }
  };

  const handleDeleteSeat = (seat, tableId) => {
    const id = seat.id ?? seat.Id;
    const label = seat.label ?? seat.Label;
    Alert.alert("Supprimer le siège", `Supprimer le siège "${label}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          setDeletingSeatId(id);
          try {
            await adminSeatService.deleteSeat(id);
            setSeatsByTableId((prev) => ({
              ...prev,
              [tableId]: (prev[tableId] ?? []).filter((s) => (s.id ?? s.Id) !== id),
            }));
          } catch {
            Alert.alert("Erreur", "Impossible de supprimer le siège.");
          } finally {
            setDeletingSeatId(null);
          }
        },
      },
    ]);
  };

  const renderTableCard = (table) => {
    const id = table.id ?? table.Id;
    const name = table.name ?? table.Name ?? "—";
    const isExpanded = expandedTableIds.has(id);
    const tableSeats = getTableSeats(id);
    const isLoadingSeats = loadingSeatsForTable[id];
    const isDeleting = deletingTableId === id;
    const badge = getCapacityBadge(tableSeats);
    const activeCount = tableSeats.filter((s) => s.isActive ?? s.IsActive).length;

    return (
      <View key={`table-${id}`} style={styles.tableCard}>
        {/* Header */}
        <TouchableOpacity style={styles.tableHeader} activeOpacity={0.8} onPress={() => toggleTable(id)}>
          <View style={styles.tableIcon}>
            <Ionicons name="grid-outline" size={18} color={colors.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.tableTitle} numberOfLines={1}>{name}</Text>
            <Text style={styles.tableMeta}>
              {isLoadingSeats
                ? "Chargement…"
                : `${tableSeats.length} siège${tableSeats.length !== 1 ? "s" : ""} · ${activeCount} actif${activeCount !== 1 ? "s" : ""}`}
            </Text>
          </View>

          {badge && !isLoadingSeats && (
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
            </View>
          )}

          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>

        {/* Occupancy bar — always visible if seats loaded */}
        {!isLoadingSeats && tableSeats.length > 0 && (
          <OccupancyBar seats={tableSeats} colors={colors} typography={typography} />
        )}

        {/* Expanded section */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Mini preview */}
            {!isLoadingSeats && tableSeats.length > 0 && (
              <TableMiniPreview
                table={table}
                seats={tableSeats}
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
              />
            )}

            {/* Table actions */}
            <View style={styles.tableActionRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => { setEditTable(table); setTableModalVisible(true); }}
              >
                <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.secondaryText}>Modifier la table</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteTable(table)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    <Text style={styles.deleteText}>Supprimer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Add seat CTA */}
            <TouchableOpacity
              style={styles.addSeatBtn}
              onPress={() => {
                setEditSeat(null);
                setDefaultTableIdForSeat(id);
                setSeatModalVisible(true);
              }}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addSeatText}>Ajouter un siège</Text>
            </TouchableOpacity>

            {/* Seats */}
            {isLoadingSeats ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
            ) : tableSeats.length === 0 ? (
              <View style={styles.emptySeatsBox}>
                <Ionicons name="desktop-outline" size={26} color={colors.textSecondary} style={{ marginBottom: 6 }} />
                <Text style={styles.emptySeatsTitle}>Aucun siège</Text>
                <Text style={styles.emptySeatsText}>Commencez par ajouter un siège à cette table.</Text>
              </View>
            ) : (
              <View style={styles.seatsGrid}>
                {tableSeats.map((seat) => (
                  <SeatChip
                    key={`seat-${seat.id ?? seat.Id}`}
                    seat={seat}
                    tableId={id}
                    onEdit={(s, tId) => {
                      setEditSeat(s);
                      setDefaultTableIdForSeat(tId);
                      setSeatModalVisible(true);
                    }}
                    onDelete={handleDeleteSeat}
                    deletingSeatId={deletingSeatId}
                    colors={colors}
                    spacing={spacing}
                    borderRadius={borderRadius}
                    typography={typography}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Gestion de l'espace</Text>
          <Text style={styles.headerSubtitle}>Tables et sièges · étage principal</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setEditTable(null); setTableModalVisible(true); }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Nouvelle table</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
        ) : tables.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="grid-outline" size={32} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyStateTitle}>Aucune table configurée</Text>
            <Text style={styles.emptyStateText}>
              Créez une première table pour commencer à organiser les sièges de votre espace.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateBtn}
              onPress={() => { setEditTable(null); setTableModalVisible(true); }}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.emptyStateBtnText}>Créer une table</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Stats banner — only when seats have been loaded for at least one table */}
            {Object.keys(seatsByTableId).length > 0 && (
              <StatsBanner
                tables={tables}
                seatsByTableId={seatsByTableId}
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
            )}
            {tables.map(renderTableCard)}
          </>
        )}
      </ScrollView>

      <EditSeatModal
        visible={isSeatModalVisible}
        seat={editSeat}
        defaultTableId={defaultTableIdForSeat}
        tableName={defaultTableIdForSeat ? getTableName(defaultTableIdForSeat) : undefined}
        onClose={() => setSeatModalVisible(false)}
        onSave={handleSaveSeat}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
      />

      <EditTableModal
        visible={isTableModalVisible}
        table={editTable}
        onClose={() => setTableModalVisible(false)}
        onSave={handleSaveTable}
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
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.text },
    headerSubtitle: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },

    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: borderRadius.md,
      gap: 6,
      ...shadows.sm,
    },
    addBtnText: { color: "#fff", fontWeight: typography.semibold, fontSize: typography.sm },

    list: { flex: 1 },
    listContent: { padding: spacing.lg, gap: 12, paddingBottom: 48 },

    tableCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      ...shadows.md,
    },
    tableHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 13,
      gap: 10,
    },
    tableIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: `${colors.primary}12`,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    tableTitle: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.text },
    tableMeta: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },

    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 99,
    },
    badgeText: { fontSize: 10, fontWeight: "600" },

    expandedContent: {
      paddingHorizontal: 14,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
    },

    tableActionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    secondaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
    secondaryText: { color: colors.textSecondary, fontWeight: typography.medium, fontSize: typography.sm },
    deleteBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
    deleteText: { color: "#EF4444", fontWeight: typography.medium, fontSize: typography.sm },

    addSeatBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingVertical: 11,
      borderRadius: borderRadius.md,
      marginBottom: 12,
    },
    addSeatText: { color: "#fff", fontSize: typography.sm, fontWeight: typography.semibold },

    seatsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    // Each chip takes roughly 1/3 of the available width
    // SeatChip uses inline styles for per-item logic

    emptySeatsBox: {
      alignItems: "center",
      paddingVertical: 28,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
      backgroundColor: colors.surface,
    },
    emptySeatsTitle: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.text, marginBottom: 4 },
    emptySeatsText: { textAlign: "center", color: colors.textSecondary, fontSize: typography.sm, paddingHorizontal: 20 },

    emptyState: { marginTop: 60, alignItems: "center", paddingHorizontal: 32 },
    emptyStateIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyStateTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 20,
    },
    emptyStateBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: borderRadius.md,
    },
    emptyStateBtnText: { color: "#fff", fontWeight: typography.semibold, fontSize: typography.sm },
  });

export default SeatManagementScreen;