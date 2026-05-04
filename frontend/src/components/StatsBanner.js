import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function StatsBanner({
  tables,
  seatsByTableId,
  colors,
  spacing,
  borderRadius,
  typography,
}) {
  const totalTables = tables.length;

  const totalSeats = Object.values(seatsByTableId).reduce(
    (sum, seats) => sum + seats.length,
    0
  );

  const activeSeats = Object.values(seatsByTableId)
    .flat()
    .filter((s) => s.isActive ?? s.IsActive).length;

  const inactiveSeats = totalSeats - activeSeats;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          gap: spacing.md,
          marginBottom: spacing.lg,
        },
        card: {
          flex: 1,
          backgroundColor: colors.surface,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
        },
        number: {
          fontSize: typography.lg,
          fontWeight: typography.bold,
          color: colors.primary,
        },
        label: {
          fontSize: typography.xs,
          color: colors.textSecondary,
          marginTop: 4,
        },
      }),
    [colors, spacing, borderRadius, typography]
  );

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="grid-outline" size={18} color={colors.primary} />
        <Text style={styles.number}>{totalTables}</Text>
        <Text style={styles.label}>Tables</Text>
      </View>

      <View style={styles.card}>
        <Ionicons name="desktop-outline" size={18} color={colors.primary} />
        <Text style={styles.number}>{totalSeats}</Text>
        <Text style={styles.label}>Seats</Text>
      </View>

      <View style={styles.card}>
        <Ionicons name="checkmark-circle-outline" size={18} color="green" />
        <Text style={styles.number}>{activeSeats}</Text>
        <Text style={styles.label}>Active</Text>
      </View>

      <View style={styles.card}>
        <Ionicons name="close-circle-outline" size={18} color="red" />
        <Text style={styles.number}>{inactiveSeats}</Text>
        <Text style={styles.label}>Inactive</Text>
      </View>
    </View>
  );
}