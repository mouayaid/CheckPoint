import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeContext";

export default function RoomList({
  rooms = [],
  getRoomAvailability,
  getBlockingReservationCount,
  onRoomPress,
}) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
  );
  const safeRooms = Array.isArray(rooms) ? rooms : [];

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionHeading}>Salles disponibles</Text>
        <Text style={styles.sectionCaption}>Appuyez pour réserver</Text>
      </View>

      {safeRooms.map((room) => {
        const avail =
          typeof getRoomAvailability === "function"
            ? getRoomAvailability(room.id)
            : { label: "Libre", color: colors.success };
        const rawReservationCount =
          typeof getBlockingReservationCount === "function"
            ? getBlockingReservationCount(room.id)
            : 0;
        const reservationCount = Number.isFinite(rawReservationCount)
          ? Math.max(0, rawReservationCount)
          : 0;
        const busyPercent = Math.min(100, (reservationCount / 10) * 100);

        return (
          <TouchableOpacity
            key={room.id}
            style={styles.roomCard}
            onPress={() => onRoomPress?.(room)}
            disabled={!onRoomPress}
            activeOpacity={0.88}
          >
            <View style={[styles.roomAccent, { backgroundColor: avail.color }]} />
            <View style={styles.roomBody}>
              <View style={styles.roomTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <Text style={styles.roomMeta}>
                    Étage {room.floor} · {room.capacity} pers.
                  </Text>
                </View>
                <View
                  style={[
                    styles.availBadge,
                    { backgroundColor: avail.color + "22" },
                  ]}
                >
                  <View
                    style={[styles.availDot, { backgroundColor: avail.color }]}
                  />
                  <Text style={[styles.availBadgeText, { color: avail.color }]}>
                    {avail.label}
                  </Text>
                </View>
              </View>

              {reservationCount > 0 && (
                <View style={styles.barWrap}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${busyPercent}%`,
                          backgroundColor: avail.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>
                    {reservationCount} créneau
                    {reservationCount !== 1 ? "x" : ""} confirmé
                    {reservationCount !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}

              <View style={styles.featRow}>
                {room.hasProjector && (
                  <View style={styles.feat}>
                    <Ionicons
                      name="videocam-outline"
                      size={12}
                      color={colors.primary}
                    />
                    <Text style={styles.featText}>Projecteur</Text>
                  </View>
                )}
                {room.hasWhiteboard && (
                  <View style={styles.feat}>
                    <Ionicons
                      name="clipboard-outline"
                      size={12}
                      color={colors.primary}
                    />
                    <Text style={styles.featText}>Tableau blanc</Text>
                  </View>
                )}
                {!room.hasProjector && !room.hasWhiteboard && (
                  <Text style={styles.featNone}>
                    Pas d'équipement supplémentaire
                  </Text>
                )}
                <View style={{ flex: 1 }} />
                <Ionicons
                  name="chevron-forward"
                  size={15}
                  color={colors.border}
                />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

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
    roomCard: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.md,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    roomAccent: { width: 5 },
    roomBody: { flex: 1, padding: spacing.md },
    roomTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    roomName: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
    },
    roomMeta: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 3,
      fontWeight: typography.medium,
    },
    availBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    availDot: { width: 6, height: 6, borderRadius: 3 },
    availBadgeText: { fontSize: typography.xs, fontWeight: typography.bold },
    barWrap: { marginBottom: spacing.sm },
    barTrack: {
      height: 3,
      backgroundColor: colors.borderLight,
      borderRadius: 2,
      overflow: "hidden",
      marginBottom: spacing.xs,
    },
    barFill: { height: "100%", borderRadius: 2 },
    barLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: typography.medium,
    },
    featRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    feat: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs - 2,
      backgroundColor: colors.infoLight,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs - 1,
      borderRadius: borderRadius.sm,
    },
    featText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: typography.semibold,
    },
    featNone: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: typography.medium,
    },
  });
