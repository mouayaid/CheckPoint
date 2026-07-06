import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeContext";

const formatDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const startOfWeekMonday = (date) => {
  const cloned = new Date(date);
  const day = cloned.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  cloned.setDate(cloned.getDate() + diff);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
};

const getWorkWeekDays = (baseDate) => {
  const monday = startOfWeekMonday(baseDate);
  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
};

const sameDateKey = (a, b) => formatDateKey(a) === formatDateKey(b);

export default function RoomFilterBar({
  weekStartDate,
  setWeekStartDate,
  selectedDate,
  setSelectedDate,
  workDays,
  today,
  roomDayLoadError,
  selectedDateReadable,
  selectedDayRoomSummary,
}) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
  );
  const currentWeekStart = startOfWeekMonday(today);
  const canGoToPreviousWeek = weekStartDate > currentWeekStart;

  const selectFirstAllowedDay = (weekStart) => {
    const firstWeekDay = getWorkWeekDays(weekStart)[0];
    const firstAllowedDay = firstWeekDay < today ? today : firstWeekDay;
    setSelectedDate(formatDateKey(firstAllowedDay));
  };

  return (
    <View style={styles.card}>
      <View style={styles.weekNav}>
        <TouchableOpacity
          style={[
            styles.navBtn,
            !canGoToPreviousWeek && styles.navBtnDisabled,
          ]}
          disabled={!canGoToPreviousWeek}
          onPress={() => {
            const prev = new Date(weekStartDate);
            prev.setDate(prev.getDate() - 7);
            const clampedPreviousWeek =
              prev < currentWeekStart ? currentWeekStart : prev;
            setWeekStartDate(clampedPreviousWeek);
            selectFirstAllowedDay(clampedPreviousWeek);
          }}
        >
          <Ionicons name="chevron-back" size={16} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.weekRange}>
          {workDays[0].toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          })}
          {" – "}
          {workDays[4].toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          })}
        </Text>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => {
            const next = new Date(weekStartDate);
            next.setDate(next.getDate() + 7);
            setWeekStartDate(next);
            selectFirstAllowedDay(next);
          }}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.dayRow}>
        {workDays.map((day) => {
          const isSelected = selectedDate === formatDateKey(day);
          const isToday = sameDateKey(day, today);
          const isPast = day < new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
          );
          return (
            <TouchableOpacity
              key={formatDateKey(day)}
              style={[
                styles.dayPill,
                isPast && styles.dayPillDisabled,
                isSelected && styles.dayPillSelected,
              ]}
              disabled={isPast}
              onPress={() => setSelectedDate(formatDateKey(day))}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.dayPillWeekday,
                  isPast && styles.dayPillTextDisabled,
                  isSelected && styles.dayPillWeekdaySelected,
                ]}
              >
                {day.toLocaleDateString("fr-FR", { weekday: "narrow" })}
              </Text>
              <Text
                style={[
                  styles.dayPillNum,
                  isPast && styles.dayPillTextDisabled,
                  isSelected && styles.dayPillNumSelected,
                ]}
              >
                {day.getDate()}
              </Text>
              {isToday && (
                <View
                  style={[
                    styles.todayDot,
                    isSelected && styles.todayDotSelected,
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {roomDayLoadError ? (
        <View style={styles.alertStrip}>
          <Ionicons name="warning-outline" size={15} color={colors.warning} />
          <Text style={styles.alertStripText}>
            Disponibilités indisponibles — actualisez.
          </Text>
        </View>
      ) : (
        <View style={styles.summaryStrip}>
          <Text style={styles.summaryDate}>{selectedDateReadable}</Text>
          {selectedDayRoomSummary && (
            <View style={styles.summaryPills}>
              <View
                style={[
                  styles.countPill,
                  { backgroundColor: colors.successLight },
                ]}
              >
                <View
                  style={[styles.countDot, { backgroundColor: colors.success }]}
                />
                <Text style={[styles.countPillText, { color: colors.success }]}>
                  {selectedDayRoomSummary.freeAllDay} libres
                </Text>
              </View>
              <View
                style={[
                  styles.countPill,
                  { backgroundColor: colors.warningLight },
                ]}
              >
                <View
                  style={[styles.countDot, { backgroundColor: colors.warning }]}
                />
                <Text style={[styles.countPillText, { color: colors.warning }]}>
                  {selectedDayRoomSummary.partial} réservées
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors, spacing, borderRadius, typography, shadows) =>
  StyleSheet.create({
    card: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    weekNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    navBtn: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    navBtnDisabled: { opacity: 0.3 },
    weekRange: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
    },
    dayRow: { flexDirection: "row", gap: spacing.xs },
    dayPill: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      position: "relative",
    },
    dayPillSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayPillDisabled: { opacity: 0.45 },
    dayPillTextDisabled: { color: colors.textTertiary },
    dayPillWeekday: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
      marginBottom: 3,
    },
    dayPillWeekdaySelected: { color: colors.primaryLight },
    dayPillNum: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
    },
    dayPillNumSelected: { color: colors.textOnPrimary },
    todayDot: {
      position: "absolute",
      bottom: 5,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.success,
    },
    todayDotSelected: { backgroundColor: colors.primaryLight },
    summaryStrip: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    summaryDate: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.sm,
      textTransform: "capitalize",
    },
    summaryPills: { flexDirection: "row", gap: spacing.sm },
    countPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    countDot: { width: 6, height: 6, borderRadius: 3 },
    countPillText: { fontSize: typography.xs, fontWeight: typography.bold },
    alertStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: spacing.sm + 2,
      backgroundColor: colors.warningLight,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    alertStripText: {
      fontSize: typography.sm,
      color: colors.text,
      fontWeight: typography.medium,
      flex: 1,
    },
  });
