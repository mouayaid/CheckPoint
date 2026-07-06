import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import api from "../services/api/axiosInstance";
import { useAuth } from "../context/AuthContext";
import { Button, Card } from "../components";
import { useTheme } from "../context/ThemeContext";

const ProfileScreen = ({ navigation }) => {
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
  const historyData = profileData?.history || [];

  const displayName = currentUser?.fullName || "Utilisateur";
  const email = currentUser?.email || "";
  const phone = currentUser?.phoneNumber || "Non renseigné";
  const departmentName = currentUser?.departmentName || "Non renseigné";
  const jobTitle = currentUser?.roleName || "Non renseigné";
  const employeeId = currentUser?.id || "N/A";

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

  const pendingRequestsCount = historyData.filter(
    (h) => h.status === "Pending",
  ).length;

  const today = new Date().toISOString().split("T")[0];

  const todayDesk = historyData.find(
    (h) =>
      h.type === "SeatReservation" &&
      h.status === "Approved" &&
      h.title?.includes(today),
  );

  const deskLabel = todayDesk ? todayDesk.title.split(" - ")[0] : "Aucun";

  const handleNavigate = (screenName) => {
    if (navigation?.navigate) {
      navigation.navigate(screenName);
    }
  };

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

  const ActionRow = ({
    icon,
    title,
    subtitle,
    onPress,
    danger = false,
    last = false,
  }) => (
    <TouchableOpacity
      style={[styles.actionRow, last && styles.noBorder]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.actionLeft}>
        <View
          style={[
            styles.actionIconWrap,
            danger && {
              backgroundColor: colors.errorLight || colors.surfaceMuted,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={21}
            color={danger ? colors.error || "#DC2626" : colors.primary}
          />
        </View>

        <View style={styles.actionTextWrap}>
          <Text
            style={[
              styles.actionTitle,
              danger && { color: colors.error || "#DC2626" },
            ]}
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text style={styles.actionSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const StatCard = ({ icon, label, value }) => (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
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
      overflow: "hidden",
      padding: 0,
    },
    headerTop: {
      backgroundColor: colors.primary,
      paddingTop: spacing.xl,
      paddingBottom: 54,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
    },
    avatarWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: colors.background,
      marginBottom: spacing.md,
    },
    avatarText: {
      fontSize: 30,
      fontWeight: typography.bold,
      color: colors.primary,
    },
    headerName: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: "#FFFFFF",
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    headerEmail: {
      fontSize: typography.sm,
      color: "rgba(255,255,255,0.86)",
      textAlign: "center",
    },
    headerBottom: {
      marginTop: -34,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      alignItems: "center",
    },
    roleBadge: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    roleText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    profileMeta: {
      width: "100%",
      gap: spacing.sm,
    },
    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    metaText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
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
    statsRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 120,
    },
    statIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    statValue: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
      maxWidth: "100%",
    },
    statLabel: {
      fontSize: typography.xs || typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 17,
    },
    actionsCard: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    actionLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: spacing.md,
    },
    actionIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    actionTextWrap: {
      flex: 1,
    },
    actionTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    actionSubtitle: {
      marginTop: 3,
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    footer: {
      marginTop: spacing.sm,
      paddingBottom: spacing.lg,
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
            <View style={styles.headerTop}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{initials || "U"}</Text>
              </View>

              <Text style={styles.headerName}>{displayName}</Text>

              {!!email && (
                <Text style={styles.headerEmail} numberOfLines={1}>
                  {email}
                </Text>
              )}
            </View>

            <View style={styles.headerBottom}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{role}</Text>
              </View>

              <View style={styles.profileMeta}>
                <View style={styles.metaPill}>
                  <Ionicons
                    name="business-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.metaText}>{department}</Text>
                </View>

                <View style={styles.metaPill}>
                  <Ionicons
                    name="briefcase-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.metaText}>{jobTitle}</Text>
                </View>
              </View>
            </View>
          </Card>

          <Card style={[styles.card, styles.infoCard]}>
            <Text style={styles.sectionTitle}>Informations personnelles</Text>

            <InfoRow
              icon="mail-outline"
              label="Email"
              value={email || "Non renseigné"}
            />
            <InfoRow icon="call-outline" label="Téléphone" value={phone} />
            <InfoRow
              icon="card-outline"
              label="ID Employé"
              value={String(employeeId)}
              last
            />
          </Card>

          <Card style={[styles.card, styles.infoCard]}>
            <Text style={styles.sectionTitle}>
              Informations professionnelles
            </Text>

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

          {isEmployee && (
            <View>
              <Text style={styles.sectionTitle}>Aperçu rapide</Text>

              <View style={styles.statsRow}>
                <StatCard
                  icon="airplane-outline"
                  label="Congés restants"
                  value={currentUser?.leaveBalance?.toString() || "0"}
                />
                <StatCard
                  icon="time-outline"
                  label="Demandes en attente"
                  value={pendingRequestsCount.toString()}
                />
                <StatCard
                  icon="desktop-outline"
                  label="Desk du jour"
                  value={deskLabel}
                />
              </View>
            </View>
          )}

          <Card style={[styles.card, styles.actionsCard]}>
            <Text style={styles.sectionTitle}>Paramètres</Text>

            <ActionRow
              icon={darkMode ? "moon" : "sunny-outline"}
              title="Apparence"
              subtitle={
                darkMode
                  ? "Le mode sombre est activé"
                  : "Le mode clair est activé"
              }
              onPress={toggleTheme}
              last
            />
          </Card>

          {(isEmployee || isManager || isAdmin) && (
            <Card style={[styles.card, styles.actionsCard]}>
              <Text style={styles.sectionTitle}>Accès rapides</Text>

              {isEmployee && (
                <>
                  <ActionRow
                    icon="document-text-outline"
                    title="Mes demandes"
                    subtitle="Consulter vos demandes administratives"
                    onPress={() => handleNavigate("GeneralRequest")}
                  />

                  <ActionRow
                    icon="calendar-clear-outline"
                    title="Mes congés"
                    subtitle="Voir vos demandes de congé"
                    onPress={() => handleNavigate("LeaveRequest")}
                  />

                </>
              )}

              {isManager && (
                <ActionRow
                  icon="desktop-outline"
                  title="Mes réservations"
                  subtitle="Consulter vos réservations de salles"
                  onPress={() => handleNavigate("Rooms")}
                  last
                />
              )}

              {isAdmin && (
                <>
                  <ActionRow
                    icon="checkmark-done-outline"
                    title="Approbations"
                    subtitle="Traiter les demandes et comptes en attente"
                    onPress={() => handleNavigate("Approvals")}
                  />

                  <ActionRow
                    icon="people-circle-outline"
                    title="Gestion des utilisateurs"
                    subtitle="Gérer les comptes utilisateurs"
                    onPress={() => handleNavigate("UserManagement")}
                  />

                  <ActionRow
                    icon="megaphone-outline"
                    title="Annonces"
                    subtitle="Gérer les annonces"
                    onPress={() => handleNavigate("ManageAnnouncements")}
                    last
                  />
                </>
              )}
            </Card>
          )}
          <View style={styles.footer}>
            <Button title="Se déconnecter" variant="danger" onPress={signOut} />
          </View>
        </>
      )}
    </ScrollView>
  );
};

export default ProfileScreen;
