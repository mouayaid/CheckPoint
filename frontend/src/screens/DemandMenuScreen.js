import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../context/ThemeContext";

const DEMAND_OPTIONS = [
  {
    key: "leave",
    title: "Demande de congé",
    subtitle: "Congés payés et suivi du solde.",
    icon: "calendar-outline",
    route: "LeaveRequest",
    params: { openCreateModal: true },
  },
  {
    key: "exitAuthorization",
    title: "Autorisation de sortie",
    subtitle: "Sortie ponctuelle pendant la journée de travail.",
    icon: "exit-outline",
    route: "GeneralRequest",
    params: {
      openCreateModal: true,
      category: "ExitAuthorization",
    },
  },
  {
    key: "recovery",
    title: "Demande de récupération",
    subtitle: "Récupération d'heures ou de journées.",
    icon: "refresh-circle-outline",
    route: "GeneralRequest",
    params: {
      openCreateModal: true,
      category: "Recovery",
    },
  },
  {
    key: "remoteWork",
    title: "Télétravail",
    subtitle: "Demande de travail à distance.",
    icon: "home-outline",
    route: "GeneralRequest",
    params: {
      openCreateModal: true,
      category: "RemoteWork",
    },
  },
  {
    key: "document",
    title: "Documents",
    subtitle: "Attestation, justificatif ou document administratif.",
    icon: "document-attach-outline",
    route: "GeneralRequest",
    params: {
      openCreateModal: true,
      category: "Document",
    },
  },
];

export default function DemandMenuScreen({ navigation }) {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        testID="demandMenu.scrollView"
        contentContainerStyle={styles.content}
      >

        {DEMAND_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            testID={`demandMenu.option.${option.key}`}
            style={styles.optionCard}
            activeOpacity={0.84}
            onPress={() => navigation.navigate(option.route, option.params)}
          >
            <View style={styles.optionIcon}>
              <Ionicons name={option.icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: typography.xl,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    optionCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight ?? `${colors.primary}18`,
    },
    optionText: {
      flex: 1,
    },
    optionTitle: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      marginBottom: 4,
    },
    optionSubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 19,
    },
  });
