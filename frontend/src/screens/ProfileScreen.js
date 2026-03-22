import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { Button, Card } from "../components";
import { useTheme } from "../context/ThemeContext";

const ProfileScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const { user, signOut } = useAuth();

  const displayName =
    user?.fullName || user?.firstName
      ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.fullName
      : "User";

  const email = user?.email || "";
  const role = user?.role || "";

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.lg,
      justifyContent: "space-between",
    },

    card: {
      alignItems: "center",
      marginTop: spacing.lg,
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

    footer: {
      paddingBottom: spacing.xl,
    },
  });

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <View style={styles.avatarWrap}>
          <Ionicons name="person" size={40} color={colors.primary} />
        </View>

        <Text style={styles.name}>{displayName}</Text>

        {email ? <Text style={styles.email}>{email}</Text> : null}

        {role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{role}</Text>
          </View>
        ) : null}
      </Card>

      <View style={styles.footer}>
        <Button title="Log out" variant="danger" onPress={signOut} />
      </View>
    </View>
  );
};

export default ProfileScreen;