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
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { adminSeatService } from "../../services/api/adminSeatService";

/* ══════════════════════════════════
   Edit/Add Modal
══════════════════════════════════ */
const EditSeatModal = ({ visible, seat, onClose, onSave, colors, spacing, typography, borderRadius }) => {
  const [label, setLabel] = useState("");
  const [officeTableId, setOfficeTableId] = useState("");
  const [positionX, setPositionX] = useState("0");
  const [positionY, setPositionY] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setLabel(seat?.label ?? seat?.Label ?? "");
      setOfficeTableId(String(seat?.officeTableId ?? seat?.OfficeTableId ?? ""));
      setPositionX(String(seat?.positionX ?? seat?.PositionX ?? "0"));
      setPositionY(String(seat?.positionY ?? seat?.PositionY ?? "0"));
      setIsActive(seat ? (seat?.isActive ?? seat?.IsActive ?? true) : true);
    }
  }, [visible, seat]);

  const handleSave = async () => {
    if (!label.trim()) {
      Alert.alert("Validation", "L'étiquette du siège est obligatoire.");
      return;
    }
    const tableId = Number(officeTableId);
    if (isNaN(tableId) || tableId <= 0) {
      Alert.alert("Validation", "ID de table invalide.");
      return;
    }
    setSaving(true);
    try {
      const dto = {
        label: label.trim(),
        officeTableId: tableId,
        positionX: Number(positionX) || 0,
        positionY: Number(positionY) || 0,
        isActive,
      };
      await onSave(seat?.id ?? seat?.Id, dto);
      onClose();
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder le siège.");
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
    btnRow:    { flexDirection: "row", gap: 10, marginTop: spacing.md },
    cancel:    { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: borderRadius.lg, borderWidth: 1.5, borderColor: colors.border },
    cancelTxt: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textSecondary },
    save:      { flex: 2, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: borderRadius.lg, backgroundColor: colors.primary },
    saveTxt:   { fontSize: typography.base, fontWeight: typography.semibold, color: "#fff" },
    statusToggle: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: 10 },
  }), [colors, spacing, typography, borderRadius]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.handle} />
            <Text style={s.title}>{seat ? "Modifier le siège" : "Ajouter un siège"}</Text>

            <Text style={s.label}>Étiquette (Label)</Text>
            <TextInput style={s.input} value={label} onChangeText={setLabel} placeholder="Ex: S12" placeholderTextColor={colors.placeholder} editable={!saving} />

            <Text style={s.label}>ID de la Table (OfficeTable)</Text>
            <TextInput style={s.input} value={officeTableId} onChangeText={setOfficeTableId} keyboardType="numeric" placeholder="ID de la table" placeholderTextColor={colors.placeholder} editable={!saving} />

            <Text style={s.label}>Position X</Text>
            <TextInput style={s.input} value={positionX} onChangeText={setPositionX} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.placeholder} editable={!saving} />

            <Text style={s.label}>Position Y</Text>
            <TextInput style={s.input} value={positionY} onChangeText={setPositionY} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.placeholder} editable={!saving} />

            {seat && (
              <TouchableOpacity style={s.statusToggle} onPress={() => setIsActive(!isActive)}>
                <Ionicons name={isActive ? "checkbox" : "square-outline"} size={24} color={isActive ? colors.primary : colors.textSecondary} />
                <Text style={s.label}>Siège Actif</Text>
              </TouchableOpacity>
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
  const styles = useMemo(() => createStyles(colors, spacing, typography, borderRadius, shadows), [colors, spacing, typography, borderRadius, shadows]);

  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editSeat, setEditSeat] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadSeats = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await adminSeatService.getAllSeats();
      setSeats(adminSeatService.extractData(res) || []);
    } catch {
      Alert.alert("Erreur", "Impossible de charger les sièges.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadSeats(); }, []));

  const handleSave = async (id, dto) => {
    if (id) {
      const res = await adminSeatService.updateSeat(id, dto);
      const updated = adminSeatService.extractData(res);
      setSeats((prev) => prev.map((s) => ((s.id ?? s.Id) === id ? { ...s, ...updated } : s)));
    } else {
      const res = await adminSeatService.createSeat(dto);
      const created = adminSeatService.extractData(res);
      setSeats((prev) => [...prev, created]);
    }
  };

  const handleDelete = (seat) => {
    const id = seat.id ?? seat.Id;
    const label = seat.label ?? seat.Label;
    Alert.alert(
      "Supprimer",
      `Voulez-vous vraiment supprimer le siège "${label}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            setDeletingId(id);
            try {
              await adminSeatService.deleteSeat(id);
              setSeats((prev) => prev.filter((s) => (s.id ?? s.Id) !== id));
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer le siège.");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const renderSeatCard = (seat) => {
    const id = seat.id ?? seat.Id;
    const label = seat.label ?? seat.Label ?? "—";
    const tableName = seat.officeTableName ?? seat.OfficeTableName ?? "—";
    const isActive = seat.isActive ?? seat.IsActive ?? false;
    const isDeleting = deletingId === id;

    return (
      <View key={id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="desktop-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.seatName} numberOfLines={1}>{label}</Text>
            <Text style={styles.seatTable} numberOfLines={1}>Table: {tableName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? "#D1FAE5" : "#FEE2E2" }]}>
            <Text style={[styles.statusText, { color: isActive ? "#065F46" : "#991B1B" }]}>
              {isActive ? "Actif" : "Inactif"}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.editBtn} onPress={() => { setEditSeat(seat); setModalVisible(true); }}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.deleteBtn, isDeleting && { opacity: 0.5 }]} onPress={() => handleDelete(seat)} disabled={isDeleting}>
            {isDeleting ? <ActivityIndicator size="small" color="#EF4444" /> : <Ionicons name="trash-outline" size={16} color="#EF4444" />}
            <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sièges ({seats.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setEditSeat(null); setModalVisible(true); }}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSeats(true)} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : seats.length === 0 ? (
          <Text style={styles.emptyText}>Aucun siège trouvé.</Text>
        ) : (
          seats.map(renderSeatCard)
        )}
      </ScrollView>

      <EditSeatModal
        visible={isModalVisible}
        seat={editSeat}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
      />
    </View>
  );
};

const createStyles = (colors, spacing, typography, borderRadius, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.text },
  addBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.md, gap: 4 },
  addBtnText: { color: "#fff", fontWeight: typography.semibold },
  list: { flex: 1 },
  listContent: { padding: spacing.lg, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.md },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  cardHeaderText: { flex: 1 },
  seatName: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.text },
  seatTable: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.full },
  statusText: { fontSize: 11, fontWeight: typography.semibold },
  actionsRow: { flexDirection: "row", gap: 10, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  editBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
  deleteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: "#EF4444", backgroundColor: "rgba(239,68,68,0.08)" },
  actionBtnText: { fontSize: typography.sm, fontWeight: typography.semibold },
  emptyText: { textAlign: "center", color: colors.textSecondary, marginTop: 40 },
});

export default SeatManagementScreen;
