import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { eventService } from "../../services/api";
import { Card, Button, Input } from "../../components";
import EmptyState from "../../components/EmptyState";

const EVENT_TYPES = [
  { value: 1, label: "Réunion", color: "#3B82F6" },
  { value: 2, label: "Formation", color: "#10B981" },
  { value: 3, label: "Atelier", color: "#F59E0B" },
  { value: 4, label: "Conférence", color: "#8B5CF6" },
  { value: 5, label: "Social", color: "#EC4899" },
  { value: 6, label: "Annonce", color: "#6B7280" },
  { value: 7, label: "Autre", color: "#9CA3AF" },
];

const EditEventModal = ({ visible, event, onClose, onSave, colors, spacing, typography, borderRadius }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState(1);
  const [startDateTime, setStartDateTime] = useState(new Date());
  const [endDateTime, setEndDateTime] = useState(new Date());
  const [isMandatory, setIsMandatory] = useState(false);
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible && event) {
      setTitle(event.title || "");
      setDescription(event.description || "");
      setType(event.type || 1);
      setStartDateTime(new Date(event.startDateTime || Date.now()));
      setEndDateTime(new Date(event.endDateTime || Date.now() + 3600000));
      setIsMandatory(event.isMandatory || false);
      setRsvpEnabled(event.rsvpEnabled !== false);
    } else if (visible) {
      // New event defaults
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);
      const end = new Date(now);
      end.setHours(end.getHours() + 1);
      setTitle("");
      setDescription("");
      setType(1);
      setStartDateTime(now);
      setEndDateTime(end);
      setIsMandatory(false);
      setRsvpEnabled(true);
    }
  }, [visible, event]);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState("date");

  const validate = () => {
    if (!title.trim()) return "Titre requis";
    if (endDateTime <= startDateTime) return "Fin après début";
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) return Alert.alert("Erreur", error);

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        type,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        isMandatory,
        rsvpEnabled,
      };
      await onSave(event?.id, payload);
      onClose();
    } catch (e) {
      Alert.alert("Erreur", "Échec sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const s = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl },
    handle: { width: 40, height: 4, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg, borderRadius: 2 },
    title: { fontSize: typography.lg, fontWeight: "bold", color: colors.text, marginBottom: spacing.lg },
    label: { fontSize: typography.sm, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 },
    input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: typography.base, color: colors.text, marginBottom: spacing.md },
    typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
    typeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    typeChipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    typeChipText: { color: colors.text, fontWeight: "600", fontSize: typography.sm },
    typeChipTextSel: { color: "#fff" },
    timeRow: { flexDirection: "row", gap: spacing.sm },
    timeField: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.md },
    timeValue: { color: colors.text, fontWeight: "600", fontSize: typography.sm },
    timeLabel: { marginTop: 4, color: colors.textSecondary, fontSize: typography.xs },
    flagsRow: { flexDirection: "row", gap: spacing.sm },
    flagChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    flagChipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    flagChipText: { color: colors.text, fontWeight: "600" },
    flagChipTextSel: { color: "#fff" },
    btnRow: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: borderRadius.lg, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    saveBtn: { flex: 2, paddingVertical: 14, borderRadius: borderRadius.lg, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  }), [colors, spacing, typography, borderRadius]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{event ? "Modifier événement" : "Nouvel événement"}</Text>

          <Text style={s.label}>Titre</Text>
          <Input value={title} onChangeText={setTitle} placeholder="Titre de l'événement" editable={!saving} />

          <Text style={s.label}>Description</Text>
          <Input value={description} onChangeText={setDescription} placeholder="Description (optionnel)" multiline editable={!saving} />

          <Text style={s.label}>Type</Text>
          <View style={s.typeRow}>
            {EVENT_TYPES.map((opt) => {
              const selected = type === opt.value;
              return (
                <TouchableOpacity key={opt.value} style={[s.typeChip, selected && s.typeChipSel]} onPress={() => setType(opt.value)} disabled={saving}>
                  <Text style={[s.typeChipText, selected && s.typeChipTextSel]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.label}>Horaires</Text>
          <View style={s.timeRow}>
            <TouchableOpacity style={s.timeField} onPress={() => { setPickerMode("date"); setShowStartPicker(true); }} disabled={saving}>
              <Text style={s.timeValue}>{startDateTime.toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
              <Text style={s.timeLabel}>Début</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.timeField} onPress={() => { setPickerMode("date"); setShowEndPicker(true); }} disabled={saving}>
              <Text style={s.timeValue}>{endDateTime.toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
              <Text style={s.timeLabel}>Fin</Text>
            </TouchableOpacity>
          </View>

          <View style={s.flagsRow}>
            <TouchableOpacity style={[s.flagChip, isMandatory && s.flagChipSel]} onPress={() => setIsMandatory(!isMandatory)} disabled={saving}>
              <Ionicons name={isMandatory ? "radio-button-on" : "radio-button-off"} size={16} color={isMandatory ? "#fff" : colors.textSecondary} />
              <Text style={[s.flagChipText, isMandatory && s.flagChipTextSel]}>Obligatoire</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.flagChip, rsvpEnabled && s.flagChipSel]} onPress={() => setRsvpEnabled(!rsvpEnabled)} disabled={saving}>
              <Ionicons name={rsvpEnabled ? "checkmark-circle" : "ellipse-outline"} size={16} color={rsvpEnabled ? "#fff" : colors.textSecondary} />
              <Text style={[s.flagChipText, rsvpEnabled && s.flagChipTextSel]}>RSVP</Text>
            </TouchableOpacity>
          </View>

          <View style={s.btnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={{ fontSize: typography.base, fontWeight: "600", color: colors.textSecondary }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: typography.base, fontWeight: "600", color: "#fff" }}>Enregistrer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {showStartPicker && (
        <DateTimePicker
          value={startDateTime}
          mode={Platform.OS === "ios" ? "datetime" : pickerMode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            // Simplified picker logic (full Android date->time in production)
            if (date) setStartDateTime(date);
            setShowStartPicker(false);
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDateTime}
          mode={Platform.OS === "ios" ? "datetime" : pickerMode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            if (date) setEndDateTime(date);
            setShowEndPicker(false);
          }}
        />
      )}
    </Modal>
  );
};

const EventManagementScreen = () => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const { user } = useAuth();
  const role = user?.role;

  const canManage = role === 2 || role === 3 || role === 4 || role === "manager" || role === "hr" || role === "admin";
  if (!canManage) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Text style={{ color: colors.textSecondary, textAlign: "center" }}>Accès réservé aux managers, RH et admins</Text>
      </View>
    );
  }

  const styles = useMemo(() => createStyles(colors, spacing, typography, borderRadius, shadows), [colors, spacing, typography, borderRadius, shadows]);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadEvents = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await eventService.getAllEvents();
      setEvents(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      Alert.alert("Erreur", "Chargement échoué");
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadEvents();
  }, [loadEvents]));

  const handleSave = async (id, data) => {
    try {
      if (id) {
        const res = await eventService.updateEvent(id, data);
        setEvents(prev => prev.map(e => e.id === id ? res.data : e));
      } else {
        const res = await eventService.createEvent(data);
        setEvents(prev => [res.data, ...prev]);
      }
    } catch (e) {
      Alert.alert("Erreur", "Sauvegarde échouée");
    }
  };

  const handleDelete = (eventId) => {
    Alert.alert("Confirmer", "Supprimer cet événement ?", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          setDeletingId(eventId);
          try {
            await eventService.deleteEvent(eventId);
            setEvents(prev => prev.filter(e => e.id !== eventId));
          } catch (e) {
            Alert.alert("Erreur", "Suppression échouée");
          } finally {
            setDeletingId(null);
          }
        }
      }
    ]);
  };

  const renderEventCard = (event) => {
    const isDeleting = deletingId === event.id;
    const typeInfo = EVENT_TYPES.find(t => t.value === event.type) || EVENT_TYPES[6];
    const isPast = new Date(event.endDateTime) < new Date();

    return (
      <Card key={event.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: `${typeInfo.color}20` }]}>
            <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
          </View>
          <View style={styles.cardMain}>
            <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
            <Text style={styles.eventDates}>
              {new Date(event.startDateTime).toLocaleString("fr-FR", { 
                weekday: "short", day: "numeric", month: "short", 
                hour: "2-digit", minute: "2-digit" 
              })}
              {" → "}
              {new Date(event.endDateTime).toLocaleString("fr-FR", { 
                hour: "2-digit", minute: "2-digit" 
              })}
            </Text>
          </View>
          {isPast && <View style={styles.pastBadge}><Text style={styles.pastText}>Passé</Text></View>}
        </View>

        {event.description && <Text style={styles.description} numberOfLines={2}>{event.description}</Text>}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.editBtn} onPress={() => { setEditEvent(event); setModalVisible(true); }}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.deleteBtn, isDeleting && styles.disabledBtn]} 
            onPress={() => handleDelete(event.id)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                <Text style={[styles.actionText, { color: "#EF4444" }]}>Supprimer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des événements ({events.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setEditEvent(null); setModalVisible(true); }}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadEvents(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : events.length === 0 ? (
          <EmptyState 
            iconName="calendar-outline" 
            title="Aucun événement" 
            subtitle="Créez le premier événement !" 
          />
        ) : (
          events.map(renderEventCard)
        )}
      </ScrollView>

      <EditEventModal
        visible={modalVisible}
        event={editEvent}
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
  header: { 
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", 
    padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border 
  },
  headerTitle: { fontSize: typography.lg, fontWeight: "bold", color: colors.text },
  addBtn: { 
    flexDirection: "row", alignItems: "center", gap: 6, 
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, 
    borderRadius: borderRadius.lg 
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: typography.sm },
  list: { flex: 1 },
  listContent: { padding: spacing.lg, paddingBottom: 60, gap: 12 },
  loader: { marginTop: 40 },
  card: { 
    padding: spacing.lg, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, 
    backgroundColor: colors.surface, ...shadows.sm 
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: spacing.md },
  typeBadge: { 
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.full, 
    alignSelf: "flex-start", minWidth: 80, alignItems: "center" 
  },
  typeBadgeText: { fontSize: typography.xs, fontWeight: "600" },
  cardMain: { flex: 1 },
  eventTitle: { fontSize: typography.base, fontWeight: "bold", color: colors.text, marginBottom: 4 },
  eventDates: { fontSize: typography.sm, color: colors.textSecondary },
  pastBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#FEF3C7", borderRadius: borderRadius.full },
  pastText: { fontSize: typography.xs, color: "#92400E", fontWeight: "600" },
  description: { fontSize: typography.sm, color: colors.text, lineHeight: 20, marginBottom: spacing.md },
  actionsRow: { flexDirection: "row", gap: 12, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  editBtn: { 
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, 
    paddingVertical: 12, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.primary, 
    backgroundColor: `${colors.primary}15` 
  },
  deleteBtn: { 
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, 
    paddingVertical: 12, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: "#EF4444", 
    backgroundColor: "rgba(239,68,68,0.1)" 
  },
  disabledBtn: { opacity: 0.6 },
  actionText: { fontSize: typography.sm, fontWeight: "600" },
});

export default EventManagementScreen;

