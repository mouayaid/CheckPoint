import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeContext";

const QUICK_DURATIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 h", minutes: 60 },
  { label: "2 h", minutes: 120 },
];

const TUNISIA_TIME_ZONE = "Africa/Tunis";

const parseApiInstant = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const hasOffset = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
    return new Date(hasOffset ? value : `${value}Z`);
  }
  return new Date(value);
};

const formatInstantTime = (dateObj) => {
  if (!dateObj) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TUNISIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(dateObj);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  const hh = values.hour ?? "00";
  const mm = values.minute ?? "00";
  return `${hh}:${mm}`;
};

const formatPickerTime = (dateObj) => {
  if (!dateObj) return "";
  const hh = String(dateObj.getHours()).padStart(2, "0");
  const mm = String(dateObj.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const formatRange = (isoStart, isoEnd) => {
  const s = parseApiInstant(isoStart);
  const e = parseApiInstant(isoEnd);
  return `${formatInstantTime(s)} – ${formatInstantTime(e)}`;
};

export default function ReservationModal({
  visible,
  resetModal,
  selectedRoom,
  selectedDate,
  selectedDateReadable,
  modalScheduleError,
  loadingReservations,
  displayedReservations,
  startTime,
  endTime,
  setStartTime,
  setEndTime,
  purpose,
  setPurpose,
  durationMinutes,
  overlapWarning,
  applyQuickDuration,
  combineDateAndTime,
  reserving,
  canSubmitRequest,
  handleReserve,
}) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
  );

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={resetModal}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={styles.modalBackdrop} onPress={resetModal} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={styles.modalRoom}>{selectedRoom?.name}</Text>
                <Text style={styles.modalDate}>{selectedDateReadable}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={resetModal}>
                <Ionicons
                  name="close"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalDivider} />

            {modalScheduleError && (
              <View style={styles.errorBanner}>
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={colors.error}
                />
                <Text style={styles.errorBannerText}>{modalScheduleError}</Text>
              </View>
            )}

            <Text style={styles.modalSectionLabel}>Créneaux confirmés</Text>

            {loadingReservations ? (
              <Text style={styles.mutedText}>Chargement du planning…</Text>
            ) : displayedReservations.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyInlineText}>
                  Aucun créneau pour cette journée
                </Text>
              </View>
            ) : (
              <View style={styles.timelineWrap}>
                {[...displayedReservations]
                  .sort(
                    (a, b) =>
                      parseApiInstant(a.startDateTime || a.startDate || a.start) -
                      parseApiInstant(b.startDateTime || b.startDate || b.start),
                  )
                  .map((r, i) => {
                    const who =
                      r.reservedBy?.fullName ||
                      r.reservedBy?.FullName ||
                      r.reservedBy?.userName;
                    return (
                      <View key={r.id} style={styles.timelineItem}>
                        <View style={styles.timelineLeft}>
                          <View style={styles.timelineDot} />
                          {i < displayedReservations.length - 1 && (
                            <View style={styles.timelineLine} />
                          )}
                        </View>
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineTime}>
                            {formatRange(
                              r.startDateTime || r.startDate || r.start,
                              r.endDateTime || r.endDate || r.end,
                            )}
                          </Text>
                          {!!who && (
                            <Text style={styles.timelineWho} numberOfLines={1}>
                              {who}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}

            <Text
              style={[styles.modalSectionLabel, { marginTop: spacing.xxl }]}
            >
              Votre créneau
            </Text>

            <View style={styles.timePickers}>
              <Pressable
                style={styles.timePicker}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={styles.timePickerLabel}>Début</Text>
                <Text style={styles.timePickerValue}>
                  {startTime ? formatPickerTime(startTime) : "--:--"}
                </Text>
              </Pressable>
              <View style={styles.timePickerSep}>
                <Ionicons name="arrow-forward" size={16} color={colors.border} />
              </View>
              <Pressable
                style={styles.timePicker}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={styles.timePickerLabel}>Fin</Text>
                <Text style={styles.timePickerValue}>
                  {endTime ? formatPickerTime(endTime) : "--:--"}
                </Text>
              </Pressable>
            </View>

            {startTime && endTime && (
              <View style={styles.durationBar}>
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.durationText}>{durationMinutes}</Text>
              </View>
            )}

            <View style={styles.quickRow}>
              {QUICK_DURATIONS.map((item) => (
                <TouchableOpacity
                  key={item.minutes}
                  style={styles.quickChip}
                  onPress={() => applyQuickDuration(item.minutes)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickChipText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startTime || new Date()}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, date) => {
                  setShowStartPicker(false);
                  if (event.type === "dismissed") return;
                  setStartTime(date);
                  if (date && endTime) {
                    const s = combineDateAndTime(selectedDate, date);
                    const e = combineDateAndTime(selectedDate, endTime);
                    if (e <= s) {
                      const ne = new Date(date);
                      ne.setMinutes(ne.getMinutes() + 30);
                      setEndTime(ne);
                    }
                  }
                }}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endTime || startTime || new Date()}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, date) => {
                  setShowEndPicker(false);
                  if (event.type !== "dismissed") setEndTime(date);
                }}
              />
            )}

            <Text style={[styles.modalSectionLabel, { marginTop: spacing.xl }]}>
              Objet <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={styles.purposeInput}
              placeholder="Ex. : Planification sprint avec l'équipe Design"
              placeholderTextColor={colors.placeholder}
              value={purpose}
              onChangeText={setPurpose}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={resetModal}
                disabled={reserving}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!canSubmitRequest || reserving) && styles.submitBtnDisabled,
                ]}
                onPress={handleReserve}
                disabled={!canSubmitRequest || reserving}
                activeOpacity={0.88}
              >
                {!reserving && (
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={colors.textOnPrimary}
                  />
                )}
                <Text style={styles.submitBtnText}>
                  {reserving ? "Envoi…" : "Confirmer"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footerTip}>
              Si le créneau a été pris entre-temps, actualisez et choisissez une
              autre plage.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors, spacing, borderRadius, typography, shadows) =>
  StyleSheet.create({
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    modalSheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: "93%",
      ...shadows.lg,
    },
    modalHandle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: borderRadius.full,
      backgroundColor: colors.border,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    modalBody: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxxl,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
    },
    modalRoom: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
      letterSpacing: -0.4,
    },
    modalDate: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginTop: 3,
      fontWeight: typography.medium,
      textTransform: "capitalize",
    },
    modalCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    modalDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginBottom: spacing.lg,
    },
    modalSectionLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.textTertiary,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
    },
    errorBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      backgroundColor: colors.errorLight,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.error,
      marginBottom: spacing.md,
    },
    errorBannerText: {
      fontSize: typography.sm,
      color: colors.error,
      flex: 1,
      lineHeight: 18,
    },
    emptyInline: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    emptyInlineText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      fontWeight: typography.medium,
    },
    timelineWrap: { gap: 0 },
    timelineItem: { flexDirection: "row", gap: spacing.md },
    timelineLeft: { width: 16, alignItems: "center" },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 2,
      borderColor: colors.border,
      marginTop: 2,
    },
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: colors.borderLight,
      marginVertical: 2,
    },
    timelineContent: { flex: 1, paddingBottom: spacing.md },
    timelineTime: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
    },
    timelineWho: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: typography.medium,
    },
    timePickers: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    timePicker: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    timePickerLabel: {
      fontSize: 11,
      fontWeight: typography.bold,
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    timePickerValue: {
      fontSize: typography.xxxl,
      fontWeight: typography.bold,
      color: colors.text,
      letterSpacing: -0.5,
    },
    timePickerSep: { paddingTop: spacing.lg },
    durationBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs + 2,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 1,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    durationText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.primary,
      flex: 1,
    },
    quickRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    quickChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 1,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickChipText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
    },
    purposeInput: {
      minHeight: 88,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: typography.base,
      color: colors.text,
      backgroundColor: colors.inputBackground,
      lineHeight: 22,
    },
    modalActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: spacing.md + 2,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    cancelBtnText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.textSecondary,
    },
    submitBtn: {
      flex: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs + 2,
      paddingVertical: spacing.md + 2,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      ...shadows.md,
    },
    submitBtnDisabled: { opacity: 0.4 },
    submitBtnText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.textOnPrimary,
    },
    footerTip: {
      fontSize: typography.xs,
      color: colors.textTertiary,
      textAlign: "center",
      marginTop: spacing.md,
      lineHeight: 18,
    },
    mutedText: {
      fontSize: typography.sm,
      color: colors.textTertiary,
      fontStyle: "italic",
    },
  });
