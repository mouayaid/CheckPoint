import React, { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeContext";

const StatusChip = ({ text, dotColor, styles }) => {
  return (
    <View style={styles.heroChip}>
      <View style={[styles.heroChipDot, { backgroundColor: dotColor }]} />
      <Text style={styles.heroChipText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
};

const StatsRow = ({
  deskChipText,
  deskChipColor,
  attendanceChipText,
  attendanceChipColor,
  attendanceSummary,
  loadingAttendance,
}) => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius),
    [colors, spacing, typography, borderRadius],
  );

  return (
    <>
      <View style={styles.heroChipRow}>
        <StatusChip
          text={deskChipText}
          dotColor={deskChipColor}
          styles={styles}
        />
        <StatusChip
          text={attendanceChipText}
          dotColor={attendanceChipColor}
          styles={styles}
        />
      </View>

      <View style={styles.attendanceCard}>
        <View style={styles.attendanceHeaderRow}>
          <View style={styles.attendanceTitleRow}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={15}
              color={colors.textOnPrimary}
            />
            <Text style={styles.attendanceCardTitle}>Présence du mois</Text>
          </View>

          {loadingAttendance ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.attendanceMeta}>
              {attendanceSummary.checkedInCount}✓ ·{" "}
              {attendanceSummary.missedCount}✕
            </Text>
          )}
        </View>

        {!loadingAttendance && (
          <>
            <View style={styles.attDayRow}>
              {attendanceSummary.recentDays.map((item) => {
                const backgroundColor =
                  item.type === "checked"
                    ? "rgba(74,222,128,0.18)"
                    : item.type === "missed"
                      ? "rgba(251,146,60,0.22)"
                      : item.type === "today"
                        ? "rgba(255,255,255,0.18)"
                        : "rgba(255,255,255,0.06)";

                const borderColor =
                  item.type === "checked"
                    ? "rgba(74,222,128,0.45)"
                    : item.type === "missed"
                      ? "rgba(251,146,60,0.55)"
                      : item.type === "today"
                        ? "rgba(255,255,255,0.38)"
                        : "rgba(255,255,255,0.08)";

                return (
                  <View
                    key={item.key}
                    style={[
                      styles.attDay,
                      { backgroundColor, borderColor },
                      item.type === "today" && styles.attDayToday,
                    ]}
                  >
                    {item.type === "checked" ? (
                      <Ionicons name="checkmark" size={14} color="#4ade80" />
                    ) : item.type === "missed" ? (
                      <Ionicons name="close" size={14} color="#fb923c" />
                    ) : (
                      <Text
                        style={[
                          styles.attDayLabel,
                          item.type === "empty" && { opacity: 0 },
                        ]}
                      >
                        {item.label}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            <Text style={styles.attLegend}>
              Vert = validé · orange = manqué · blanc = aujourd'hui
            </Text>
          </>
        )}
      </View>
    </>
  );
};

const createStyles = (colors, spacing, typography, borderRadius) =>
  StyleSheet.create({
    heroChipRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    heroChip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: borderRadius.md,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },

    heroChipDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },

    heroChipText: {
      flex: 1,
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.medium,
      color: colors.textOnPrimary,
      opacity: 0.92,
    },

    attendanceCard: {
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },

    attendanceHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },

    attendanceTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    attendanceCardTitle: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.textOnPrimary,
    },

    attendanceMeta: {
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.medium,
      color: colors.textOnPrimary,
      opacity: 0.84,
    },

    attDayRow: {
      flexDirection: "row",
      gap: 5,
    },

    attDay: {
      flex: 1,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    attDayToday: {
      transform: [{ scale: 1.05 }],
    },

    attDayLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textOnPrimary,
    },

    attLegend: {
      marginTop: 8,
      fontSize: 10,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textOnPrimary,
      opacity: 0.68,
    },
  });

export default StatsRow;
