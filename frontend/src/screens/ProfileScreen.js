import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import api from "../services/api/axiosInstance";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components";
import { useTheme } from "../context/ThemeContext";

const ProfileScreen = () => {
  const { colors, spacing, typography, borderRadius, toggleTheme, darkMode } =
    useTheme();

  const { user, signOut } = useAuth();

  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchProfile = async () => {
        setLoadingProfile(true);

        try {
          const response = await api.get("/Profile/me");

          if (response?.success && isActive) {
            setProfileData(response.data);
          }
        } catch (error) {
          console.error("Error fetching profile", error);
        } finally {
          if (isActive) setLoadingProfile(false);
        }
      };

      fetchProfile();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const currentUser = profileData?.user || user;

  const displayName = currentUser?.fullName || "Utilisateur";
  const email = currentUser?.email || "Non renseigné";
  const phone = currentUser?.phoneNumber || "Non renseigné";
  const departmentName = currentUser?.departmentName || "Non renseigné";
  const jobTitle = currentUser?.roleName || "Non renseigné";

  const joinDate = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString("fr-FR")
    : "Non renseigné";

  const rawRole =
    currentUser?.roleId ?? currentUser?.role ?? currentUser?.roleName;

  const normalizedRole =
    typeof rawRole === "string" ? rawRole.toLowerCase() : rawRole;

  const isEmployee =
    normalizedRole === 1 ||
    normalizedRole === "employee" ||
    normalizedRole === "employé" ||
    normalizedRole === "employe";

  const isManager = normalizedRole === 2 || normalizedRole === "manager";

  const isAdmin = normalizedRole === 3 || normalizedRole === "admin";

  const role = isAdmin
    ? "Admin"
    : isManager
      ? "Manager"
      : isEmployee
        ? "Employé"
        : "Utilisateur";

  const department = isAdmin ? "Administration globale" : departmentName;

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const InfoRow = ({ icon, label, value, last = false }) => (
    <View style={[styles.infoRow, last && styles.noBorder]}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIcon}>
          <Ionicons name={icon} size={17} color={colors.primary} />
        </View>

        <Text style={styles.infoLabel}>{label}</Text>
      </View>

      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      minHeight: 350,
    },
    loadingText: {
      marginTop: spacing.md,
      color: colors.textSecondary,
      fontSize: typography.sm,
    },
    card: {
      borderRadius: borderRadius.lg,
    },
    profileCard: {
      padding: spacing.lg,
    },
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatarWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    avatarText: {
      fontSize: 24,
      fontWeight: typography.bold,
      color: "#FFFFFF",
    },
    profileTextWrap: {
      flex: 1,
    },
    headerName: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    roleBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      marginBottom: spacing.xs,
    },
    roleText: {
      fontSize: typography.xs || typography.sm,
      fontWeight: typography.semibold,
      color: colors.primary,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    metaText: {
      flex: 1,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },
    sectionTitle: {
      fontSize: typography.lg,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: spacing.md,
    },
    infoCard: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    noBorder: {
      borderBottomWidth: 0,
    },
    infoLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: spacing.md,
    },
    infoIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    infoLabel: {
      fontSize: typography.base,
      color: colors.text,
      fontWeight: typography.medium,
    },
    infoValue: {
      flex: 1,
      textAlign: "right",
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    settingsCard: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    settingLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: spacing.md,
    },
    settingIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    settingTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    settingSubtitle: {
      marginTop: 3,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },
    logoutCard: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    logoutRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
    },
    logoutIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.errorLight || colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    logoutText: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.error || "#DC2626",
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {loadingProfile ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      ) : (
        <>
          <Card style={[styles.card, styles.profileCard]}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{initials || "U"}</Text>
              </View>

              <View style={styles.profileTextWrap}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {displayName}
                </Text>

                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{role}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons
                    name="business-outline"
                    size={15}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {department}
                  </Text>
                </View>
              </View>
            </View>
          </Card>

          <Card style={[styles.card, styles.infoCard]}>
            <Text style={styles.sectionTitle}>Informations</Text>

            <InfoRow icon="mail-outline" label="Email" value={email} />
            <InfoRow icon="call-outline" label="Téléphone" value={phone} />
            <InfoRow icon="briefcase-outline" label="Poste" value={jobTitle} />
            <InfoRow
              icon="business-outline"
              label="Département"
              value={department}
            />
            <InfoRow
              icon="calendar-outline"
              label="Date d’entrée"
              value={String(joinDate)}
              last
            />
          </Card>

          <Card style={[styles.card, styles.settingsCard]}>
            <Text style={styles.sectionTitle}>Préférences</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Ionicons
                    name={darkMode ? "moon" : "sunny-outline"}
                    size={21}
                    color={colors.primary}
                  />
                </View>

                <View>
                  <Text style={styles.settingTitle}>Mode sombre</Text>
                  <Text style={styles.settingSubtitle}>
                    {darkMode ? "Activé" : "Désactivé"}
                  </Text>
                </View>
              </View>

              <Switch
                value={darkMode}
                onValueChange={toggleTheme}
                trackColor={{
                  false: colors.border,
                  true: colors.primary,
                }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>

          <Card style={[styles.card, styles.logoutCard]}>
            <TouchableOpacity
              style={styles.logoutRow}
              activeOpacity={0.8}
              onPress={signOut}
            >
              <View style={styles.logoutIcon}>
                <Ionicons
                  name="log-out-outline"
                  size={22}
                  color={colors.error || "#DC2626"}
                />
              </View>

              <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
          </Card>
        </>
      )}
    </ScrollView>
  );
};

export default ProfileScreen;