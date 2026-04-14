import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { Button, Card } from "../components";
import { useTheme } from "../context/ThemeContext";

const ProfileScreen = () => {
  const {
    colors,
    spacing,
    typography,
    borderRadius,
    toggleTheme,
    darkMode,
  } = useTheme();

  const { user, signOut } = useAuth();

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.fullName ||
    "Utilisateur";

  const email = user?.email || "";

  const rawRole = user?.role;
  const role =
    typeof rawRole === "string"
      ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
      : rawRole === 2
        ? "Manager"
        : rawRole === 3
          ? "Admin"
          : rawRole === 1
            ? "Employé"
            : "";

  const handleSignOut = () => {
    signOut();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.lg,
      justifyContent: "space-between",
    },
    content: {
      gap: spacing.lg,
    },
    card: {
      alignItems: "center",
      marginTop: spacing.lg,
      paddingVertical: spacing.xl,
    },
    avatarWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    name: {
      fontSize: typography.xxl,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    email: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    roleBadge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    roleText: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.textSecondary,
    },
    settingsCard: {
      paddingVertical: spacing.sm,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
    },
    settingLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    settingTextWrap: {
      flex: 1,
    },
    settingTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    settingSubtitle: {
      marginTop: 2,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },
    footer: {
      paddingBottom: spacing.xl,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person" size={40} color={colors.primary} />
          </View>

          <Text style={styles.name}>{displayName}</Text>

          {!!email && <Text style={styles.email}>{email}</Text>}

          {!!role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{role}</Text>
            </View>
          )}
        </Card>

        <Card style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.8}
            onPress={toggleTheme}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name={darkMode ? "moon" : "sunny-outline"}
                size={22}
                color={colors.primary}
              />
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingTitle}>Apparence</Text>
                <Text style={styles.settingSubtitle}>
                  {darkMode
                    ? "Le mode sombre est activé"
                    : "Le mode clair est activé"}
                </Text>
              </View>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </Card>
      </View>

      <View style={styles.footer}>
        <Button title="Se déconnecter" variant="danger" onPress={handleSignOut} />
      </View>
    </View>
  );
};

export default ProfileScreen;