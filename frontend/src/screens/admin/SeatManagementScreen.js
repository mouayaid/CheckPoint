import React, { useCallback, useMemo, useState , useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { adminSeatService } from "../../services/api/adminSeatService";
import { adminOfficeTableService } from "../../services/api/adminOfficeTableService";
import { adminLayoutService } from "../../services/api/adminLayoutService";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import StatsBanner from "../../components/StatsBanner";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}



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
      Alert.alert(
        "Validation",
        "Les positions X et Y doivent être numériques.",
      );
      return;
    }
    setSaving(true);
    try {
      const baseDto = {
        label: label.trim(),
        officeTableId: tableId,
        positionX: posX,
        positionY: posY,
      };
      const dto = seat ? { ...baseDto, isActive } : baseDto;
      await onSave(seat?.id ?? seat?.Id, dto);
      onClose();
    } catch (err) {
      Alert.alert(
        "Erreur",
        err?.response?.data?.message || "Impossible de sauvegarder le siège.",
      );
    } finally {
      setSaving(false);
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: spacing.xl,
          paddingBottom: 36,
          maxHeight: "80%",
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: "center",
          marginBottom: spacing.lg,
        },
        title: {
          fontSize: typography.lg,
          fontWeight: typography.semibold,
          color: colors.text,
          marginBottom: 4,
        },
        tableCtx: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: colors.surfaceMuted,
          borderRadius: borderRadius.md,
          paddingHorizontal: 10,
          paddingVertical: 6,
          marginBottom: spacing.lg,
          alignSelf: "flex-start",
        },
        tableCtxText: { fontSize: typography.xs, color: colors.textSecondary },
        label: {
          fontSize: typography.sm,
          fontWeight: typography.medium,
          color: colors.textSecondary,
          marginBottom: 6,
        },
        input: {
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: typography.base,
          color: colors.text,
          marginBottom: spacing.md,
        },
        advancedToggle: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 8,
          marginBottom: spacing.sm,
        },
        advancedText: { fontSize: typography.sm, color: colors.textSecondary },
        statusToggle: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: spacing.md,
          gap: 10,
          paddingVertical: 10,
        },
        statusLabel: { fontSize: typography.sm, color: colors.text, flex: 1 },
        row: { flexDirection: "row", gap: spacing.md },
        col: { flex: 1 },
        btnRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
        cancel: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          borderRadius: borderRadius.lg,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        cancelTxt: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.textSecondary,
        },
        save: {
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
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={s.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.handle} />
            <Text style={s.title}>
              {seat ? "Modifier le siège" : "Ajouter un siège"}
            </Text>

            {tableName && (
              <View style={s.tableCtx}>
                <Ionicons
                  name="grid-outline"
                  size={12}
                  color={colors.textSecondary}
                />
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
              <TouchableOpacity
                style={s.statusToggle}
                onPress={() => setIsActive(!isActive)}
              >
                <Ionicons
                  name={isActive ? "checkbox" : "square-outline"}
                  size={22}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
                <Text style={s.statusLabel}>Siège actif</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={s.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Ionicons
                name={
                  showAdvanced
                    ? "chevron-down-outline"
                    : "chevron-forward-outline"
                }
                size={14}
                color={colors.textSecondary}
              />
              <Text style={s.advancedText}>
                Paramètres avancés (coordonnées)
              </Text>
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
              <TouchableOpacity
                style={s.cancel}
                onPress={onClose}
                disabled={saving}
              >
                <Text style={s.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.save}
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
      Alert.alert(
        "Erreur",
        err?.response?.data?.message || "Impossible de sauvegarder la table.",
      );
    } finally {
      setSaving(false);
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: spacing.xl,
          paddingBottom: 36,
          maxHeight: "80%",
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: "center",
          marginBottom: spacing.lg,
        },
        title: {
          fontSize: typography.lg,
          fontWeight: typography.semibold,
          color: colors.text,
          marginBottom: spacing.lg,
        },
        label: {
          fontSize: typography.sm,
          fontWeight: typography.medium,
          color: colors.textSecondary,
          marginBottom: 6,
        },
        input: {
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: typography.base,
          color: colors.text,
          marginBottom: spacing.md,
        },
        advancedToggle: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 8,
          marginBottom: spacing.sm,
        },
        advancedText: { fontSize: typography.sm, color: colors.textSecondary },
        row: { flexDirection: "row", gap: spacing.md },
        col: { flex: 1 },
        btnRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
        cancel: {
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
        save: {
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
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={s.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.handle} />
            <Text style={s.title}>
              {table ? "Modifier la table" : "Ajouter une table"}
            </Text>

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

            <TouchableOpacity
              style={s.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Ionicons
                name={
                  showAdvanced
                    ? "chevron-down-outline"
                    : "chevron-forward-outline"
                }
                size={14}
                color={colors.textSecondary}
              />
              <Text style={s.advancedText}>
                Paramètres avancés (position & dimensions)
              </Text>
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
              <TouchableOpacity
                style={s.cancel}
                onPress={onClose}
                disabled={saving}
              >
                <Text style={s.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.save}
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

/* ══════════════════════════════════
   Main Screen
══════════════════════════════════ */
const SeatManagementScreen = () => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const navigation = useNavigation();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const [tables, setTables] = useState([]);
  const [seatsByTableId, setSeatsByTableId] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editSeat, setEditSeat] = useState(null);
  const [isSeatModalVisible, setSeatModalVisible] = useState(false);
  const [defaultTableIdForSeat, setDefaultTableIdForSeat] = useState(null);

  const [editTable, setEditTable] = useState(null);
  const [isTableModalVisible, setTableModalVisible] = useState(false);

  const [deletingSeatId, setDeletingSeatId] = useState(null);
  const [deletingTableId, setDeletingTableId] = useState(null);

  const getTableName = (tableId) => {
    const t = tables.find((t) => (t.id ?? t.Id) === tableId);
    return t?.name ?? t?.Name ?? "";
  };

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const tablesRes = await adminOfficeTableService.getAllOfficeTables();
      const tableList = adminOfficeTableService.extractData(tablesRes) || [];
      setTables(tableList);

      const newSeatsMap = {};
      await Promise.all(
        tableList.map(async (t) => {
          const tId = t.id ?? t.Id;
          try {
            const res = await adminSeatService.getByTable(tId);
            const data = adminSeatService.extractData(res) || [];
            newSeatsMap[tId] = data;
          } catch {
            newSeatsMap[tId] = [];
          }
        })
      );
      setSeatsByTableId(newSeatsMap);
    } catch {
      Alert.alert("Erreur", "Impossible de charger les données.");
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

  const handleSaveTable = async (id, dto) => {
    if (id) {
      const res = await adminOfficeTableService.updateOfficeTable(id, dto);
      const updated = adminOfficeTableService.extractData(res);
      setTables((prev) =>
        prev.map((t) => ((t.id ?? t.Id) === id ? { ...t, ...updated } : t)),
      );
    } else {
      const res = await adminOfficeTableService.createOfficeTable(dto);
      const created = adminOfficeTableService.extractData(res);
      setTables((prev) => [...prev, created]);
      setSeatsByTableId((prev) => ({ ...prev, [created.id ?? created.Id]: [] }));
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
              setSeatsByTableId((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
              });
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer la table.");
            } finally {
              setDeletingTableId(null);
            }
          },
        },
      ],
    );
  };

  const handleSaveSeat = async (id, dto) => {
    const tableId = dto.officeTableId ?? defaultTableIdForSeat;
    if (id) {
      const res = await adminSeatService.updateSeat(id, dto);
      const updated = adminSeatService.extractData(res);
      setSeatsByTableId((prev) => ({
        ...prev,
        [tableId]: (prev[tableId] ?? []).map((s) =>
          (s.id ?? s.Id) === id ? { ...s, ...updated } : s,
        ),
      }));
    } else {
      const res = await adminSeatService.createSeat(dto);
      const created = adminSeatService.extractData(res);
      setSeatsByTableId((prev) => ({
        ...prev,
        [tableId]: [...(prev[tableId] ?? []), created],
      }));
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
              [tableId]: (prev[tableId] ?? []).filter(
                (s) => (s.id ?? s.Id) !== id,
              ),
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

  const getTableLayout = (tableSeats) => {
    const count = tableSeats.length;
    if (count === 11) {
      return {
        type: "eleven",
        leftSeats: tableSeats.slice(0, 5),
        rightSeats: tableSeats.slice(5, 10),
        endSeat: tableSeats[10],
      };
    }
    if (count === 8) {
      return {
        type: "eight",
        leftSeats: tableSeats.slice(0, 4),
        rightSeats: tableSeats.slice(4, 8),
      };
    }
    const middle = Math.ceil(count / 2);
    return {
      type: "generic",
      leftSeats: tableSeats.slice(0, middle),
      rightSeats: tableSeats.slice(middle),
    };
  };

  const renderSeat = (seat, tableId) => {
    const isActive = seat.isActive ?? seat.IsActive;
    const isDeleting = deletingSeatId === (seat.id ?? seat.Id);

    return (
      <TouchableOpacity
        key={`seat-${seat.id ?? seat.Id}`}
        style={[
          styles.seatBox,
          {
            backgroundColor: isActive ? colors.primary : "#94A3B8",
            borderColor: "transparent",
          },
        ]}
        onPress={() => {
          setEditSeat(seat);
          setDefaultTableIdForSeat(tableId);
          setSeatModalVisible(true);
        }}
        onLongPress={() => handleDeleteSeat(seat, tableId)}
        delayLongPress={500}
        activeOpacity={0.8}
      >
        {isDeleting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons
              name={isActive ? "desktop-outline" : "close-circle-outline"}
              size={14}
              color="#fff"
            />
            <Text style={styles.seatLabel}>{seat.label ?? seat.Label}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderSeatColumn = (seatList, tableId) => (
    <View style={styles.seatColumn}>
      {seatList.map((seat) => renderSeat(seat, tableId))}
    </View>
  );

  const renderTableCard = (table) => {
    const id = table.id ?? table.Id;
    const name = table.name ?? table.Name ?? "—";
    const isDeleting = deletingTableId === id;
    
    const tableSeats = seatsByTableId[id] || [];
    
    const sortedSeats = [...tableSeats].sort((a, b) => {
      const n = (l) => {
        const m = String(l).match(/\d+/);
        return m ? parseInt(m[0], 10) : 999;
      };
      return n(a.label ?? a.Label) - n(b.label ?? b.Label);
    });

    const layout = getTableLayout(sortedSeats);
    const isEleven = layout.type === "eleven";

    return (
      <View key={`table-${id}`} style={styles.tableCard}>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.tableTitle}>{name}</Text>
          <Text style={styles.tableSubtitle}>{sortedSeats.length} postes</Text>
        </View>

        <View style={styles.tableWrap}>
          <View style={styles.tableRow}>
            {renderSeatColumn(layout.leftSeats, id)}

            <View style={styles.tableCenter}>
              <View
                style={[
                  styles.tableVisual,
                  isEleven ? styles.tableVisualLarge : styles.tableVisualMedium,
                ]}
              >
                <View style={styles.tableInnerLine} />
                <Text style={styles.tableVisualText} numberOfLines={2}>{name}</Text>
                
                <View style={styles.tableActions}>
                  <TouchableOpacity
                    style={styles.tableActionBtn}
                    onPress={() => {
                      setEditTable(table);
                      setTableModalVisible(true);
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.tableActionBtn}
                    onPress={() => {
                      setEditSeat(null);
                      setDefaultTableIdForSeat(id);
                      setSeatModalVisible(true);
                    }}
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.tableActionBtn}
                    onPress={() => handleDeleteTable(table)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    )}
                  </TouchableOpacity>
                </View>

              </View>
            </View>

            {renderSeatColumn(layout.rightSeats, id)}
          </View>

          {layout.type === "eleven" && layout.endSeat && (
            <View style={styles.endSeatContainer}>
              {renderSeat(layout.endSeat, id)}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Gestion de l'espace</Text>
          <Text style={styles.headerSubtitle}>
            Édition des tables et sièges
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => navigation.navigate("AdminOfficeLayout")}
          >
            <Ionicons name="map-outline" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setEditTable(null);
              setTableModalVisible(true);
            }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Nouvelle table</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 48 }}
          />
        ) : tables.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Ionicons
                name="grid-outline"
                size={32}
                color={colors.textSecondary}
              />
            </View>
            <Text style={styles.emptyStateTitle}>Aucune table configurée</Text>
            <Text style={styles.emptyStateText}>
              Créez une première table pour commencer à organiser les sièges de
              votre espace.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateBtn}
              onPress={() => {
                setEditTable(null);
                setTableModalVisible(true);
              }}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.emptyStateBtnText}>Créer une table</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
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
        tableName={
          defaultTableIdForSeat
            ? getTableName(defaultTableIdForSeat)
            : undefined
        }
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
    headerTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },

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
    addBtnText: {
      color: "#fff",
      fontWeight: typography.semibold,
      fontSize: typography.sm,
    },

    list: { flex: 1 },
    listContent: { padding: spacing.lg, gap: 12, paddingBottom: 120 },

    tableCard: {
      padding: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: spacing.lg,
    },
    tableHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    tableTitle: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
      letterSpacing: 0.3,
    },
    tableSubtitle: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
    },
    tableWrap: {
      alignItems: "center",
    },
    tableRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "stretch",
      gap: spacing.md,
      width: "100%",
    },
    tableCenter: {
      justifyContent: "center",
      alignItems: "center",
      minWidth: 112,
      flex: 1,
    },
    tableVisual: {
      width: "100%",
      maxWidth: 160,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      overflow: "hidden",
      ...shadows.sm,
    },
    tableVisualLarge: { minHeight: 280 },
    tableVisualMedium: { minHeight: 220 },
    tableInnerLine: {
      position: "absolute",
      top: 16,
      bottom: 16,
      width: 3,
      borderRadius: 999,
      backgroundColor: colors.border,
      opacity: 0.6,
    },
    tableVisualText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
      letterSpacing: 0.3,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    tableActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.sm,
    },
    tableActionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    seatColumn: {
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 2,
    },
    seatBox: {
      width: 56,
      height: 50,
      borderRadius: borderRadius.md,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: "transparent",
      ...shadows.sm,
    },
    seatLabel: {
      color: "#fff",
      fontSize: 11,
      fontWeight: typography.bold,
      marginTop: 2,
    },
    endSeatContainer: {
      marginTop: spacing.md,
      alignItems: "center",
    },

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
    emptyStateBtnText: {
      color: "#fff",
      fontWeight: typography.semibold,
      fontSize: typography.sm,
    },
  });

export default SeatManagementScreen;
