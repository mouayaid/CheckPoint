import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { eventService } from "../../services/api";
import { Card, Button, Input } from "../../components";

const EVENT_TYPES = [
  { value: 1, label: "Réunion" },
  { value: 2, label: "Formation" },
  { value: 3, label: "Atelier" },
  { value: 4, label: "Conférence" },
  { value: 5, label: "Social" },
  { value: 6, label: "Annonce" },
  { value: 7, label: "Autre" },
];

export default function ManageEventsScreen() {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const styles = createStyles(
    colors,
    spacing,
    typography,
    borderRadius,
    shadows
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState(1);

  const [startDateTime, setStartDateTime] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  });

  const [endDateTime, setEndDateTime] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 2);
    return d;
  });

  const [isMandatory, setIsMandatory] = useState(false);
  const [rsvpEnabled, setRsvpEnabled] = useState(true);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startPickerMode, setStartPickerMode] = useState("date");
  const [endPickerMode, setEndPickerMode] = useState("date");
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) return "Veuillez saisir un titre.";
    if (!startDateTime || !endDateTime)
      return "Veuillez sélectionner les horaires.";
    if (endDateTime <= startDateTime)
      return "L'heure de fin doit être après l'heure de début.";

    return null;
  };

  const resetForm = () => {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);

    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    setTitle("");
    setDescription("");
    setType(1);
    setStartDateTime(start);
    setEndDateTime(end);
    setIsMandatory(false);
    setRsvpEnabled(true);
  };

  const handleSave = async () => {
    const error = validate();

    if (error) {
      Alert.alert("Validation", error);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        type,
        roomId: null,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        isMandatory,
        rsvpEnabled,
      };

      const res = await eventService.createEvent(payload);

      if (!res?.success) {
        Alert.alert(
          "Erreur",
          res?.message || "Impossible de créer l'événement."
        );
        return;
      }

      Alert.alert("Succès", "Événement créé avec succès.");
      resetForm();
    } catch (e) {
      Alert.alert(
        "Erreur",
        e?.response?.data?.message ||
          e?.message ||
          "Impossible de créer l'événement."
      );
    } finally {
      setSaving(false);
    }
  };

  const typeLabel =
    EVENT_TYPES.find((eventType) => eventType.value === type)?.label || "—";

  const formatDateTime = (date) =>
    date.toLocaleString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleStartPickerChange = (event, selectedDate) => {
    if (Platform.OS === "ios") {
      if (event?.type === "dismissed" || !selectedDate) return;

      setStartDateTime(selectedDate);

      if (selectedDate >= endDateTime) {
        const newEnd = new Date(selectedDate);
        newEnd.setHours(newEnd.getHours() + 1);
        setEndDateTime(newEnd);
      }
      return;
    }

    if (event?.type === "dismissed") {
      setShowStartPicker(false);
      setStartPickerMode("date");
      return;
    }

    if (!selectedDate) return;

    if (startPickerMode === "date") {
      const next = new Date(startDateTime);
      next.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      setStartDateTime(next);
      setStartPickerMode("time");
      return;
    }

    const next = new Date(startDateTime);
    next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    setStartDateTime(next);
    setShowStartPicker(false);
    setStartPickerMode("date");

    if (next >= endDateTime) {
      const newEnd = new Date(next);
      newEnd.setHours(newEnd.getHours() + 1);
      setEndDateTime(newEnd);
    }
  };

  const handleEndPickerChange = (event, selectedDate) => {
    if (Platform.OS === "ios") {
      if (event?.type === "dismissed" || !selectedDate) return;
      setEndDateTime(selectedDate);
      return;
    }

    if (event?.type === "dismissed") {
      setShowEndPicker(false);
      setEndPickerMode("date");
      return;
    }

    if (!selectedDate) return;

    if (endPickerMode === "date") {
      const next = new Date(endDateTime);
      next.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      setEndDateTime(next);
      setEndPickerMode("time");
      return;
    }

    const next = new Date(endDateTime);
    next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    setEndDateTime(next);
    setShowEndPicker(false);
    setEndPickerMode("date");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={colors.primary}
            />
          </View>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Créer un événement</Text>
            <Text style={styles.headerSubtitle}>
              Admin / RH : créez un événement visible dans l’application.
            </Text>
          </View>
        </View>
      </Card>

      <Card style={styles.formCard}>
        <Input
          label="Titre"
          value={title}
          onChangeText={setTitle}
          placeholder="Ex. Réunion mensuelle"
          editable={!saving}
        />

        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Détails (optionnel)"
          editable={!saving}
          multiline
        />

        <Text style={styles.sectionLabel}>Type</Text>
        <View style={styles.typeRow}>
          {EVENT_TYPES.map((option) => {
            const selected = option.value === type;

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.typeChip,
                  selected && styles.typeChipSelected,
                ]}
                onPress={() => setType(option.value)}
                activeOpacity={0.85}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    selected && styles.typeChipTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Horaires</Text>
        <View style={styles.timeRow}>
          <TouchableOpacity
            style={styles.timeField}
            onPress={() => {
              setStartPickerMode("date");
              setShowStartPicker(true);
            }}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Text style={styles.timeValue}>{formatDateTime(startDateTime)}</Text>
            <Text style={styles.timeLabel}>Début</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.timeField}
            onPress={() => {
              setEndPickerMode("date");
              setShowEndPicker(true);
            }}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Text style={styles.timeValue}>{formatDateTime(endDateTime)}</Text>
            <Text style={styles.timeLabel}>Fin</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.flagsRow}>
          <TouchableOpacity
            style={[
              styles.flagChip,
              isMandatory && styles.flagChipSelected,
            ]}
            onPress={() => setIsMandatory((prev) => !prev)}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Ionicons
              name={isMandatory ? "alert-circle" : "alert-circle-outline"}
              size={16}
              color={isMandatory ? colors.textOnPrimary : colors.textSecondary}
            />
            <Text
              style={[
                styles.flagChipText,
                isMandatory && styles.flagChipTextSelected,
              ]}
            >
              Obligatoire
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.flagChip,
              rsvpEnabled && styles.flagChipSelected,
            ]}
            onPress={() => setRsvpEnabled((prev) => !prev)}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Ionicons
              name={
                rsvpEnabled
                  ? "checkmark-circle"
                  : "checkmark-circle-outline"
              }
              size={16}
              color={rsvpEnabled ? colors.textOnPrimary : colors.textSecondary}
            />
            <Text
              style={[
                styles.flagChipText,
                rsvpEnabled && styles.flagChipTextSelected,
              ]}
            >
              RSVP
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.previewText}>
          Type : {typeLabel} •{" "}
          {isMandatory ? "Obligatoire" : "Non obligatoire"} •{" "}
          {rsvpEnabled ? "RSVP activé" : "RSVP désactivé"}
        </Text>

        <Button
          title={saving ? "Création..." : "Créer l'événement"}
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
        />
      </Card>

      {showStartPicker && (
        <DateTimePicker
          value={startDateTime}
          mode={Platform.OS === "ios" ? "datetime" : startPickerMode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleStartPickerChange}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDateTime}
          mode={Platform.OS === "ios" ? "datetime" : endPickerMode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleEndPickerChange}
        />
      )}
    </ScrollView>
  );
}

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },

    headerCard: {
      padding: spacing.lg,
      backgroundColor: colors.surface,
      ...(shadows?.sm || {}),
    },

    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
    },

    headerTextWrap: {
      flex: 1,
    },

    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    headerTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: 4,
    },

    headerSubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    formCard: {
      marginTop: spacing.lg,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      ...(shadows?.sm || {}),
    },

    sectionLabel: {
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
    },

    typeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },

    typeChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },

    typeChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    typeChipText: {
      color: colors.text,
      fontWeight: typography.semibold,
      fontSize: typography.sm,
    },

    typeChipTextSelected: {
      color: colors.textOnPrimary,
    },

    timeRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },

    timeField: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },

    timeValue: {
      color: colors.text,
      fontWeight: typography.semibold,
      fontSize: typography.sm,
    },

    timeLabel: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: typography.xs,
    },

    flagsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
      flexWrap: "wrap",
    },

    flagChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },

    flagChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    flagChipText: {
      color: colors.text,
      fontWeight: typography.semibold,
      fontSize: typography.sm,
    },

    flagChipTextSelected: {
      color: colors.textOnPrimary,
    },

    previewText: {
      marginTop: spacing.md,
      fontSize: typography.xs,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    saveButton: {
      marginTop: spacing.lg,
    },
  });