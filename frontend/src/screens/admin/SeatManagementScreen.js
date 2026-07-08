import logger from "../../utils/logger";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCode from "react-native-qrcode-svg";
import ViewShot from "react-native-view-shot";
import { useTheme } from "../../context/ThemeContext";
import { adminSeatService } from "../../services/api/adminSeatService";
import { adminOfficeTableService } from "../../services/api/adminOfficeTableService";
import { adminLayoutService } from "../../services/api/adminLayoutService";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import StatsBanner from "../../components/StatsBanner";
import { getTableSeatLayout } from "../../utils/seatLayout";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SheetModalHeader = ({ icon, title, subtitle, colors, spacing, typography }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl }}>
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={23} color={colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.text }}>
        {title}
      </Text>
      <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: spacing.xs }}>
        {subtitle}
      </Text>
    </View>
  </View>
);

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
  shadows,
}) => {
  const [label, setLabel] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setLabel(seat?.label ?? seat?.Label ?? "");
      setIsActive(seat ? (seat?.isActive ?? seat?.IsActive ?? true) : true);
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
    setSaving(true);
    try {
      const baseDto = {
        label: label.trim(),
        officeTableId: tableId,
        positionX: 0,
        positionY: 0,
      };
      const dto = seat ? { ...baseDto, isActive } : baseDto;
      const saved = await onSave(seat?.id ?? seat?.Id, dto);
      if (saved !== false) onClose();
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
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.xl,
          paddingBottom: 36,
          maxHeight: "80%",
          ...shadows.lg,
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
          minHeight: 50,
        },
        statusToggle: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: spacing.lg,
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
        },
        statusLabel: { fontSize: typography.sm, color: colors.text, flex: 1 },
        statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: borderRadius.full },
        statusDot: { width: 7, height: 7, borderRadius: 4 },
        statusPillText: { fontSize: typography.xs, fontWeight: typography.semibold },
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
          minHeight: 50,
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
          minHeight: 50,
        },
        saveTxt: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.textOnPrimary,
        },
      }),
    [colors, spacing, typography, borderRadius, shadows],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => !saving && onClose()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.overlay}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => !saving && onClose()}
        />
        <View style={s.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.handle} />
            <SheetModalHeader
              icon={seat ? "create-outline" : "add-circle-outline"}
              title={seat ? "Modifier le siège" : "Ajouter un siège"}
              subtitle={
                seat
                  ? "Mettez à jour le libellé et la disponibilité."
                  : "Configurez un nouveau poste pour cette table."
              }
              colors={colors}
              spacing={spacing}
              typography={typography}
            />

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
                  name="power-outline"
                  size={22}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
                <Text style={s.statusLabel}>Disponibilité</Text>
                <View style={[s.statusPill, { backgroundColor: isActive ? colors.successLight : colors.errorLight }]}>
                  <View style={[s.statusDot, { backgroundColor: isActive ? colors.success : colors.error }]} />
                  <Text style={[s.statusPillText, { color: isActive ? colors.success : colors.error }]}>
                    {isActive ? "Actif" : "Inactif"}
                  </Text>
                </View>
              </TouchableOpacity>
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
                  <ActivityIndicator color={colors.textOnPrimary} />
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

const EditTableModal = ({
  visible,
  table,
  onClose,
  onSave,
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
}) => {
  const [name, setName] = useState("");
  const [seatCount, setSeatCount] = useState("8");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName(table?.name ?? table?.Name ?? "");
      setSeatCount(table ? "" : "8");
    }
  }, [visible, table]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Le nom de la table est obligatoire.");
      return;
    }
    const count = parseInt(seatCount, 10);
    if (!table && (isNaN(count) || count <= 0)) {
      Alert.alert("Validation", "Le nombre de sièges doit être supérieur à 0.");
      return;
    }
    setSaving(true);
    try {
      const dto = {
        name: name.trim(),
        positionX: 0,
        positionY: 0,
        width: 100,
        height: 100,
      };
      await onSave(table?.id ?? table?.Id, dto, count);
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
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.xl,
          paddingBottom: 36,
          maxHeight: "80%",
          ...shadows.lg,
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
          minHeight: 50,
        },
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
          minHeight: 50,
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
          minHeight: 50,
        },
        saveTxt: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.textOnPrimary,
        },
      }),
    [colors, spacing, typography, borderRadius, shadows],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => !saving && onClose()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.overlay}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => !saving && onClose()}
        />
        <View style={s.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.handle} />
            <SheetModalHeader
              icon={table ? "create-outline" : "grid-outline"}
              title={table ? "Modifier la table" : "Ajouter une table"}
              subtitle={
                table
                  ? "Modifiez le nom affiché dans le plan des sièges."
                  : "Créez une table et générez ses sièges automatiquement."
              }
              colors={colors}
              spacing={spacing}
              typography={typography}
            />

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

            {!table && (
              <>
                <Text style={s.label}>Nombre de sièges</Text>
                <TextInput
                  style={s.input}
                  value={seatCount}
                  onChangeText={setSeatCount}
                  keyboardType="numeric"
                  placeholder="8"
                  placeholderTextColor={colors.placeholder}
                  editable={!saving}
                />
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
                  <ActivityIndicator color={colors.textOnPrimary} />
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
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editSeat, setEditSeat] = useState(null);
  const [isSeatModalVisible, setSeatModalVisible] = useState(false);
  const [defaultTableIdForSeat, setDefaultTableIdForSeat] = useState(null);

  const [editTable, setEditTable] = useState(null);
  const [isTableModalVisible, setTableModalVisible] = useState(false);

  const [deletingSeatId, setDeletingSeatId] = useState(null);
  const [deletingTableId, setDeletingTableId] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [selectedSeatTableId, setSelectedSeatTableId] = useState(null);
  const [qrSeat, setQrSeat] = useState(null);
  const [updatingSeatStatus, setUpdatingSeatStatus] = useState(false);
  const qrRef = useRef(null);

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
        }),
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

  useEffect(() => {
    if (tables.length === 0) {
      if (selectedTableId !== null) {
        setSelectedTableId(null);
      }
      return;
    }

    const selectedExists = tables.some((table) => (table.id ?? table.Id) === selectedTableId);
    if (!selectedExists) {
      setSelectedTableId(tables[0].id ?? tables[0].Id);
    }
  }, [tables, selectedTableId]);

  const selectedTable = useMemo(
    () =>
      tables.find((table) => (table.id ?? table.Id) === selectedTableId) ??
      tables[0] ??
      null,
    [tables, selectedTableId],
  );

  const handleSaveTable = async (id, dto, seatCount) => {
    if (id) {
      const res = await adminOfficeTableService.updateOfficeTable(id, dto);
      const updated = adminOfficeTableService.extractData(res);
      setTables((prev) =>
        prev.map((t) => ((t.id ?? t.Id) === id ? { ...t, ...updated } : t)),
      );
    } else {
      const res = await adminOfficeTableService.createOfficeTable(dto);
      const created = adminOfficeTableService.extractData(res);
      const tableId = created.id ?? created.Id;
      setTables((prev) => [...prev, created]);
      setSelectedTableId(tableId);
      setSeatsByTableId((prev) => ({
        ...prev,
        [tableId]: [],
      }));

      if (seatCount && seatCount > 0) {
        const newSeats = [];
        for (let i = 1; i <= seatCount; i++) {
          const seatDto = {
            label: `S${i}`,
            officeTableId: tableId,
            positionX: 0,
            positionY: 0,
          };
          try {
            const seatRes = await adminSeatService.createSeat(seatDto);
            newSeats.push(adminSeatService.extractData(seatRes));
          } catch (e) {
            logger.error("Error creating seat", e);
          }
        }
        setSeatsByTableId((prev) => ({
          ...prev,
          [tableId]: newSeats,
        }));
      }
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
              if (selectedTableId === id) {
                setSelectedTableId(null);
              }
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

  const normalizeSeatLabel = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase();

  const handleSaveSeat = async (id, dto) => {
    const tableId = dto.officeTableId ?? defaultTableIdForSeat;
    const newLabel = normalizeSeatLabel(dto.label);

    const existingSeats = seatsByTableId[tableId] ?? [];

    const duplicateSeat = existingSeats.find((s) => {
      const seatId = s.id ?? s.Id;
      const seatLabel = normalizeSeatLabel(s.label ?? s.Label);

      // when editing, ignore the current seat itself
      return seatLabel === newLabel && seatId !== id;
    });

    if (duplicateSeat) {
      Alert.alert(
        "Validation",
        `Le siège "${dto.label}" existe déjà dans cette table.`,
      );
      return false;
    }

    if (id) {
      const res = await adminSeatService.updateSeat(id, dto);
      const updated = adminSeatService.extractData(res);

      setSeatsByTableId((prev) => ({
        ...prev,
        [tableId]: (prev[tableId] ?? []).map((s) =>
          (s.id ?? s.Id) === id ? { ...s, ...updated } : s,
        ),
      }));
      return true;
    } else {
      const res = await adminSeatService.createSeat(dto);
      const created = adminSeatService.extractData(res);

      setSeatsByTableId((prev) => ({
        ...prev,
        [tableId]: [...(prev[tableId] ?? []), created],
      }));
      return true;
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
            setSelectedSeat(null);
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

  const openSeatActions = (seat, tableId) => {
    setSelectedSeat(seat);
    setSelectedSeatTableId(tableId);
  };

  const handleToggleSeatStatus = async () => {
    if (!selectedSeat) return;
    const id = selectedSeat.id ?? selectedSeat.Id;
    const isActive = selectedSeat.isActive ?? selectedSeat.IsActive ?? true;
    const dto = {
      label: selectedSeat.label ?? selectedSeat.Label,
      positionX: selectedSeat.positionX ?? selectedSeat.PositionX ?? 0,
      positionY: selectedSeat.positionY ?? selectedSeat.PositionY ?? 0,
      isActive: !isActive,
    };
    setUpdatingSeatStatus(true);
    try {
      const res = await adminSeatService.updateSeat(id, dto);
      const responseSeat = adminSeatService.extractData(res) ?? {};
      const updated = {
        ...responseSeat,
        isActive: !isActive,
        IsActive: !isActive,
      };
      setSeatsByTableId((previous) => ({
        ...previous,
        [selectedSeatTableId]: (previous[selectedSeatTableId] ?? []).map((seat) =>
          (seat.id ?? seat.Id) === id ? { ...seat, ...updated } : seat,
        ),
      }));
      setSelectedSeat((current) => ({ ...current, ...updated }));
    } catch (error) {
      Alert.alert(
        "Erreur",
        error?.response?.data?.message || "Impossible de modifier l’état du siège.",
      );
    } finally {
      setUpdatingSeatStatus(false);
    }
  };

  const getQrValue = (seat) => {
    const id = seat?.id ?? seat?.Id;
    return seat?.qrCodeValue ?? seat?.QrCodeValue ?? `SEAT:${id}`;
  };

  const captureQr = async () => {
    if (!qrRef.current) throw new Error("QR indisponible");
    return qrRef.current.capture();
  };

  const handleShareQr = async () => {
    try {
      const uri = await captureQr();
      await Sharing.shareAsync(uri);
    } catch (error) {
      logger.error("Seat QR share error", error);
      Alert.alert("Erreur", "Impossible de partager le QR.");
    }
  };

  const handlePrintQr = async () => {
    try {
      const uri = await captureQr();
      const base64 = await fetch(uri)
        .then((response) => response.blob())
        .then(
          (blob) =>
            new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            }),
        );
      const label = qrSeat?.label ?? qrSeat?.Label ?? "Siège";
      const tableName = getTableName(selectedSeatTableId);
      await Print.printAsync({
        html: `<html><body style="text-align:center;padding-top:48px;font-family:sans-serif"><h2>${label}</h2><p>${tableName}</p><img src="${base64}" style="width:240px;height:240px"/><p>${getQrValue(qrSeat)}</p></body></html>`,
      });
    } catch (error) {
      logger.error("Seat QR print error", error);
      Alert.alert("Erreur", "Impossible d’imprimer le QR.");
    }
  };

  const renderSeat = (seat, tableId) => {
    const isActive = seat.isActive ?? seat.IsActive ?? true;
    const isDeleting = deletingSeatId === (seat.id ?? seat.Id);

    return (
      <TouchableOpacity
        key={`seat-${seat.id ?? seat.Id}`}
        style={[
          styles.seatBox,
          {
            backgroundColor: isActive ? colors.primary : colors.surfaceMuted,
            borderColor: isActive ? colors.primary : colors.border,
          },
        ]}
        onPress={() => {
          openSeatActions(seat, tableId);
        }}
        activeOpacity={0.8}
      >
        {isDeleting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons
              name={isActive ? "desktop-outline" : "close-circle-outline"}
              size={14}
              color={isActive ? colors.textOnPrimary : colors.textSecondary}
            />
            <Text
              style={[
                styles.seatLabel,
                { color: isActive ? colors.textOnPrimary : colors.textSecondary },
              ]}
            >
              {seat.label ?? seat.Label}
            </Text>
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

  const renderTableSelector = () => (
    <View style={styles.tableSelector}>
      <View style={styles.tableSelectorHeader}>
        <Text style={styles.tableSelectorTitle}>Tables</Text>
        <Text style={styles.tableSelectorCount}>{tables.length} disponibles</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tableSelectorContent}
      >
        {tables.map((table) => {
          const id = table.id ?? table.Id;
          const name = table.name ?? table.Name ?? "Table";
          const seats = seatsByTableId[id] ?? [];
          const activeSeats = seats.filter(
            (seat) => seat.isActive ?? seat.IsActive ?? true,
          ).length;
          const isSelected = id === (selectedTable?.id ?? selectedTable?.Id);

          return (
            <TouchableOpacity
              key={`table-chip-${id}`}
              style={[
                styles.tableChip,
                isSelected && styles.tableChipSelected,
              ]}
              onPress={() => setSelectedTableId(id)}
              activeOpacity={0.85}
            >
              <View style={styles.tableChipHeader}>
                <Ionicons
                  name="grid-outline"
                  size={15}
                  color={isSelected ? colors.textOnPrimary : colors.primary}
                />
                <Text
                  style={[
                    styles.tableChipName,
                    isSelected && styles.tableChipNameSelected,
                  ]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
              </View>
              <Text
                style={[
                  styles.tableChipMeta,
                  isSelected && styles.tableChipMetaSelected,
                ]}
              >
                {activeSeats}/{seats.length} actifs
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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

    const layout = getTableSeatLayout(sortedSeats);

    return (
      <View key={`table-${id}`} style={styles.tableCard}>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.tableTitle}>{name}</Text>
          <Text style={styles.tableSubtitle}>{sortedSeats.length} postes</Text>
        </View>

        <View style={styles.tableWrap}>
          {layout.topSeat && (
            <View style={styles.topSeatContainer}>
              {renderSeat(layout.topSeat, id)}
            </View>
          )}
          <View style={styles.tableRow}>
            {renderSeatColumn(layout.leftSeats, id)}

            <View style={styles.tableCenter}>
              <View
                style={[
                  styles.tableVisual,
                  {
                    minHeight: Math.max(
                      150,
                      layout.maxSideCount * 58 + Math.max(0, layout.maxSideCount - 1) * spacing.sm,
                    ),
                  },
                ]}
              >
                <View style={styles.tableInnerLine} />
                <Text style={styles.tableVisualText} numberOfLines={2}>
                  {name}
                </Text>

                <View style={styles.tableActions}>
                  <TouchableOpacity
                    style={styles.tableActionBtn}
                    onPress={() => {
                      setEditTable(table);
                      setTableModalVisible(true);
                    }}
                  >
                    <Ionicons
                      name="create-outline"
                      size={16}
                      color={colors.textSecondary}
                    />
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
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color="#EF4444"
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {renderSeatColumn(layout.rightSeats, id)}
          </View>
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
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
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
            {renderTableSelector()}
            {selectedTable ? renderTableCard(selectedTable) : null}
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
        shadows={shadows}
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
        shadows={shadows}
      />

      <Modal
        visible={Boolean(selectedSeat)}
        transparent
        animationType="slide"
        onRequestClose={() => !updatingSeatStatus && setSelectedSeat(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => !updatingSeatStatus && setSelectedSeat(null)}
          />
          <View style={styles.actionSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.actionHeader}>
              <View style={styles.actionIconBadge}>
                <Ionicons name="desktop-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>
                  {selectedSeat?.label ?? selectedSeat?.Label ?? "Siège"}
                </Text>
                <Text style={styles.actionSubtitle}>
                  {getTableName(selectedSeatTableId)}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      (selectedSeat?.isActive ?? selectedSeat?.IsActive ?? true)
                        ? colors.successLight
                        : colors.errorLight,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        (selectedSeat?.isActive ?? selectedSeat?.IsActive ?? true)
                          ? colors.success
                          : colors.error,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        (selectedSeat?.isActive ?? selectedSeat?.IsActive ?? true)
                          ? colors.success
                          : colors.error,
                    },
                  ]}
                >
                  {(selectedSeat?.isActive ?? selectedSeat?.IsActive ?? true)
                    ? "Actif"
                    : "Inactif"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => {
                setQrSeat(selectedSeat);
                setSelectedSeat(null);
              }}
            >
              <Ionicons name="qr-code-outline" size={21} color={colors.primary} />
              <Text style={styles.sheetActionText}>Voir le QR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => {
                setEditSeat(selectedSeat);
                setDefaultTableIdForSeat(selectedSeatTableId);
                setSelectedSeat(null);
                setSeatModalVisible(true);
              }}
            >
              <Ionicons name="create-outline" size={21} color={colors.text} />
              <Text style={styles.sheetActionText}>Modifier le siège</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetAction}
              onPress={handleToggleSeatStatus}
              disabled={updatingSeatStatus}
            >
              {updatingSeatStatus ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name={(selectedSeat?.isActive ?? selectedSeat?.IsActive ?? true) ? "pause-circle-outline" : "checkmark-circle-outline"}
                  size={21}
                  color={colors.text}
                />
              )}
              <Text style={styles.sheetActionText}>
                {(selectedSeat?.isActive ?? selectedSeat?.IsActive ?? true)
                  ? "Désactiver"
                  : "Activer"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetAction, styles.destructiveAction]}
              onPress={() => handleDeleteSeat(selectedSeat, selectedSeatTableId)}
              disabled={deletingSeatId === (selectedSeat?.id ?? selectedSeat?.Id)}
            >
              {deletingSeatId === (selectedSeat?.id ?? selectedSeat?.Id) ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Ionicons name="trash-outline" size={21} color={colors.error} />
              )}
              <Text style={[styles.sheetActionText, { color: colors.error }]}>Supprimer le siège</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(qrSeat)}
        transparent
        animationType="fade"
        onRequestClose={() => setQrSeat(null)}
      >
        <View style={styles.qrOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setQrSeat(null)}
          />
          <View style={styles.qrCard}>
            <View style={styles.qrHeaderBadge}>
              <Ionicons name="qr-code-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.qrTitle}>{qrSeat?.label ?? qrSeat?.Label}</Text>
            <Text style={styles.qrSubtitle}>{getTableName(selectedSeatTableId)}</Text>
            <ViewShot
              ref={qrRef}
              options={{ format: "png", quality: 1 }}
              style={styles.qrCapture}
            >
              <QRCode value={getQrValue(qrSeat)} size={210} backgroundColor="#FFFFFF" color="#000000" />
            </ViewShot>
            <Text style={styles.qrValue}>{getQrValue(qrSeat)}</Text>
            <TouchableOpacity style={styles.primaryModalButton} onPress={handlePrintQr}>
              <Ionicons name="print-outline" size={19} color="#FFFFFF" />
              <Text style={styles.primaryModalButtonText}>Imprimer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryModalButton} onPress={handleShareQr}>
              <Ionicons name="share-outline" size={19} color={colors.text} />
              <Text style={styles.secondaryModalButtonText}>Partager / Enregistrer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeQrButton} onPress={() => setQrSeat(null)}>
              <Text style={styles.closeQrText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

    tableSelector: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    tableSelectorHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    tableSelectorTitle: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
    },
    tableSelectorCount: {
      fontSize: typography.xs,
      color: colors.textSecondary,
    },
    tableSelectorContent: {
      gap: spacing.sm,
      paddingRight: spacing.sm,
    },
    tableChip: {
      minWidth: 124,
      maxWidth: 170,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    tableChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
      ...shadows.sm,
    },
    tableChipHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: 4,
    },
    tableChipName: {
      flex: 1,
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    tableChipNameSelected: {
      color: colors.textOnPrimary,
    },
    tableChipMeta: {
      fontSize: typography.xs,
      color: colors.textSecondary,
    },
    tableChipMetaSelected: {
      color: colors.textOnPrimary,
      opacity: 0.9,
    },

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
    topSeatContainer: {
      alignItems: "center",
      marginBottom: spacing.md,
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
      fontSize: 11,
      fontWeight: typography.bold,
      marginTop: 2,
    },
    modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
    modalBackdrop: { flex: 1 },
    actionSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      paddingBottom: spacing.xxxl,
      ...shadows.md,
    },
    sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg },
    actionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
    actionIconBadge: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    actionTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.text },
    actionSubtitle: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
    statusBadge: { flexDirection: "row", alignItems: "center", borderRadius: borderRadius.full, paddingHorizontal: 9, paddingVertical: 5 },
    statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
    statusText: { fontSize: typography.xs, fontWeight: typography.semibold },
    sheetAction: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
    sheetActionText: { fontSize: typography.base, fontWeight: typography.medium, color: colors.text },
    destructiveAction: { marginTop: spacing.xs, backgroundColor: colors.errorLight, borderColor: colors.error },
    qrOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.overlay },
    qrCard: { width: "100%", maxWidth: 380, alignItems: "center", backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.lg },
    qrHeaderBadge: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted, marginBottom: spacing.sm },
    qrTitle: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.text },
    qrSubtitle: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.lg },
    qrCapture: { backgroundColor: "#FFFFFF", padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
    qrValue: { fontSize: typography.xs, color: colors.textSecondary, marginVertical: spacing.md },
    primaryModalButton: { width: "100%", minHeight: 48, borderRadius: borderRadius.md, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm },
    primaryModalButtonText: { color: "#FFFFFF", fontSize: typography.sm, fontWeight: typography.semibold },
    secondaryModalButton: { width: "100%", minHeight: 48, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm },
    secondaryModalButtonText: { color: colors.text, fontSize: typography.sm, fontWeight: typography.semibold },
    closeQrButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xl, marginTop: spacing.sm },
    closeQrText: { color: colors.textSecondary, fontSize: typography.sm, fontWeight: typography.medium },

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
