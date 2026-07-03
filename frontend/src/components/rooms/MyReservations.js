import React, { useMemo, useState } from "react";
import {
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeContext";

const MY_RESERVATION_FILTERS = ["All", "Upcoming", "Past"];

const MY_RESERVATION_FILTER_LABELS_FR = {
  All: "Tout",
  Upcoming: "À venir",
  Past: "Passées",
};

function normalizeStatusKey(status) {
  if (typeof status === "number" && Number.isFinite(status)) {
    const map = {
      0: "pending",
      1: "active",
      2: "cancelled",
      3: "completed",
      4: "rejected",
      5: "inprogress",
    };
    return map[status] ?? String(status);
  }
  return String(status ?? "").toLowerCase();
}

function StatusBadge({ status, colors }) {
  const key = normalizeStatusKey(status);

  const configs = {
    pending: {
      label: "En attente",
      bg: colors.warningLight,
      fg: colors.warning,
      dot: colors.warning,
    },
    active: {
      label: "Confirmée",
      bg: colors.successLight,
      fg: colors.success,
      dot: colors.success,
    },
    approved: {
      label: "Confirmée",
      bg: colors.successLight,
      fg: colors.success,
      dot: colors.success,
    },
    inprogress: {
      label: "En cours",
      bg: colors.infoLight,
      fg: colors.info,
      dot: colors.info,
    },
    completed: {
      label: "Terminée",
      bg: colors.surfaceMuted,
      fg: colors.textSecondary,
      dot: colors.textTertiary,
    },
    rejected: {
      label: "Rejetée",
      bg: colors.errorLight,
      fg: colors.error,
      dot: colors.error,
    },
    cancelled: {
      label: "Annulée",
      bg: colors.surfaceMuted,
      fg: colors.textSecondary,
      dot: colors.border,
    },
  };

  const config = configs[key] || {
    label: String(status ?? "—"),
    bg: colors.surfaceMuted,
    fg: colors.textSecondary,
    dot: colors.textTertiary,
  };

  return (
    <View style={[badgeStyles.badge, { backgroundColor: config.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: config.dot }]} />
      <Text style={[badgeStyles.text, { color: config.fg }]}>
        {config.label}
      </Text>
    </View>
  );
}

export default function MyReservations({
  myReservations,
  loadingMyReservations,
  reservationIdOf,
  getRoomResActionState,
  formatReservationDate,
  onScanPress,
  onFinishReservation,
  onCancelReservation,
  onOpenReservation,
}) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
  );
  const [reservationFilter, setReservationFilter] = useState("All");

  const filteredMyReservations = useMemo(() => {
    const now = new Date();
    const sorted = [...myReservations].sort(
      (a, b) =>
        new Date(b.startDateTime || b.startDate || b.start) -
        new Date(a.startDateTime || a.startDate || a.start),
    );
    if (reservationFilter === "Upcoming")
      return sorted.filter(
        (r) => new Date(r.endDateTime || r.endDate || r.end) >= now,
      );
    if (reservationFilter === "Past")
      return sorted.filter(
        (r) => new Date(r.endDateTime || r.endDate || r.end) < now,
      );
    return sorted;
  }, [myReservations, reservationFilter]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionHeading}>Mes réservations</Text>
        <Text style={styles.sectionCaption}>
          Scannez le QR pour démarrer
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {MY_RESERVATION_FILTERS.map((filter) => {
          const active = reservationFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => {
                LayoutAnimation.configureNext(
                  LayoutAnimation.Presets.easeInEaseOut,
                );
                setReservationFilter(filter);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {MY_RESERVATION_FILTER_LABELS_FR[filter] ?? filter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loadingMyReservations ? (
        <Text style={styles.mutedText}>Chargement…</Text>
      ) : filteredMyReservations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={32} color={colors.border} />
          <Text style={styles.emptyStateTitle}>Aucune réservation</Text>
          <Text style={styles.emptyStateText}>
            Sélectionnez une salle ci-dessous pour réserver un créneau.
          </Text>
        </View>
      ) : (
        filteredMyReservations.map((reservation) => {
          const rid = reservationIdOf(reservation);
          const { key, canStart, canFinish } =
            getRoomResActionState(reservation);

          const startDate = new Date(
            reservation.startDateTime ||
              reservation.startDate ||
              reservation.start,
          );

          const canCancel =
            key !== "cancelled" &&
            key !== "completed" &&
            key !== "inprogress" &&
            startDate > new Date();

          const accentColor =
            key === "active"
              ? colors.success
              : key === "inprogress"
                ? colors.info
                : key === "pending"
                  ? colors.warning
                  : key === "rejected"
                    ? colors.error
                    : colors.border;

          return (
            <TouchableOpacity
              key={rid ?? `${reservation.startDateTime}-${reservation.roomId}`}
              style={styles.resCard}
              onPress={() => onOpenReservation(reservation)}
              activeOpacity={0.9}
            >
              <View
                style={[styles.resCardAccent, { backgroundColor: accentColor }]}
              />
              <View style={styles.resCardBody}>
                <View style={styles.resCardHeader}>
                  <Text style={styles.resCardRoom}>
                    {reservation.roomName || reservation.RoomName || "Salle"}
                  </Text>
                  <StatusBadge
                    status={reservation.status ?? reservation.Status}
                    colors={colors}
                  />
                </View>
                <View style={styles.dateRow}>
                  <Ionicons
                    name="time-outline"
                    size={13}
                    color={colors.textTertiary}
                  />
                  <Text style={styles.resCardDate}>
                    {formatReservationDate(
                      reservation.startDateTime,
                      reservation.endDateTime,
                    )}
                  </Text>
                </View>
                {!!reservation.purpose && (
                  <View style={styles.purposeRow}>
                    <Ionicons
                      name="chatbox-ellipses-outline"
                      size={13}
                      color={colors.textTertiary}
                    />
                    <Text style={styles.purposeText} numberOfLines={2}>
                      {reservation.purpose}
                    </Text>
                  </View>
                )}
                {!!reservation.managerComment && (
                  <View style={styles.commentRow}>
                    <Ionicons
                      name="information-circle-outline"
                      size={14}
                      color={colors.warning}
                    />
                    <Text style={styles.commentText}>
                      {reservation.managerComment}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.openBtn]}
                  onPress={() => onOpenReservation(reservation)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="arrow-forward-circle-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={[styles.scanBtnText, { color: colors.primary }]}> 
                    Ouvrir la réunion
                  </Text>
                </TouchableOpacity>
                {(canStart || canFinish || canCancel) && (
                  <View style={styles.resCardActions}>
                    {canStart && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.scanBtn]}
                        onPress={() => onScanPress(rid, "start")}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="qr-code-outline"
                          size={15}
                          color={colors.textOnPrimary}
                        />
                        <Text style={styles.scanBtnText}>Démarrer</Text>
                      </TouchableOpacity>
                    )}
                    {canFinish && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.scanBtnFinish]}
                        onPress={() => onFinishReservation(rid)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={15}
                          color={colors.info}
                        />
                        <Text
                          style={[styles.scanBtnText, { color: colors.info }]}
                        >
                          Terminer
                        </Text>
                      </TouchableOpacity>
                    )}

                    {canCancel && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.cancelBtn]}
                        onPress={() => onCancelReservation(rid)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={15}
                          color={colors.error}
                        />
                        <Text
                          style={[styles.scanBtnText, { color: colors.error }]}
                        >
                          Annuler
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    flexShrink: 0,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
});

const createStyles = (colors, spacing, borderRadius, typography, shadows) =>
  StyleSheet.create({
    section: { paddingHorizontal: spacing.lg, marginTop: spacing.xxl },
    sectionTitleRow: { marginBottom: spacing.md },
    sectionHeading: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      letterSpacing: -0.3,
    },
    sectionCaption: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 3,
      fontWeight: typography.medium,
    },
    tabRow: { gap: spacing.sm, paddingBottom: spacing.md },
    tab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 1,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
    },
    tabTextActive: { color: colors.textOnPrimary },
    emptyState: {
      alignItems: "center",
      paddingVertical: spacing.xxxl,
      gap: spacing.sm,
    },
    emptyStateTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
    },
    emptyStateText: {
      fontSize: typography.sm,
      color: colors.textTertiary,
      textAlign: "center",
      maxWidth: 240,
    },
    resCard: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm + 2,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    resCardAccent: { width: 4 },
    resCardBody: { flex: 1, padding: spacing.sm + 2 },
    resCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.sm,
      marginBottom: spacing.xs + 1,
    },
    resCardRoom: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
      flex: 1,
      lineHeight: 20,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: spacing.xs + 2,
    },
    resCardDate: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      fontWeight: typography.medium,
      flex: 1,
    },
    purposeRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.xs + 2,
      marginTop: 2,
    },
    purposeText: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 17,
    },
    commentRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.xs + 2,
      backgroundColor: colors.warningLight,
      padding: spacing.sm + 2,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.warning,
      marginTop: spacing.sm,
    },
    commentText: {
      fontSize: typography.xs,
      color: colors.text,
      flex: 1,
      lineHeight: 17,
    },
    resCardActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.sm + 2,
    },
    actionBtn: {
      minWidth: 104,
      flexGrow: 1,
      flexBasis: "30%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs + 2,
      minHeight: 38,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    scanBtn: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
      ...shadows.sm,
    },
    scanBtnFinish: {
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.info,
    },
    openBtn: {
      marginTop: spacing.sm + 2,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.primary,
      alignSelf: "stretch",
    },
    cancelBtn: {
      backgroundColor: colors.errorLight,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: borderRadius.md,
    },
    scanBtnText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.textOnPrimary,
      flexShrink: 1,
    },
    mutedText: {
      fontSize: typography.sm,
      color: colors.textTertiary,
      fontStyle: "italic",
    },
  });
