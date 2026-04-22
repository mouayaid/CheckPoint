import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { Button, Card } from "../components";
import { useTheme } from "../context/ThemeContext";

const ProfileScreen = ({ navigation }) => {
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
  const phone = user?.phoneNumber || user?.phone || "Non renseigné";
  const department = user?.department || "Non renseigné";
  const jobTitle = user?.jobTitle || user?.position || "Non renseigné";
  const managerName = user?.managerName || "Non renseigné";
  const employeeId = user?.employeeId || user?.id || "N/A";
  const joinDate = user?.joinDate || user?.createdAt || "Non renseigné";
  const workMode = user?.workMode || "Sur site";

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

  const isManager = rawRole === 2 || rawRole === "manager" || rawRole === "Manager";
  const isAdmin = rawRole === 3 || rawRole === "admin" || rawRole === "Admin";
  const isEmployee = rawRole === 1 || rawRole === "employee" || rawRole === "Employé";

  const handleSignOut = () => {
    signOut();
  };

  const handleNavigate = (screenName) => {
    if (navigation?.navigate) {
      navigation.navigate(screenName);
    }
  };

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  const ActionRow = ({ icon, title, subtitle, onPress, danger = false }) => (
    <TouchableOpacity
      style={styles.actionRow}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.actionLeft}>
        <View
          style={[
            styles.actionIconWrap,
            danger && { backgroundColor: colors.errorLight || colors.surfaceMuted },
          ]}
        >
          <Ionicons
            name={icon}
            size={20}
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
          {!!subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
  );

  const StatCard = ({ icon, label, value }) => (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    card: {
      borderRadius: borderRadius.lg,
    },
    profileCard: {
      alignItems: "center",
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
    },
    avatarWrap: {
      width: 90,
      height: 90,
      borderRadius: 45,
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
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    roleText: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.textSecondary,
    },
    miniInfoWrap: {
      width: "100%",
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    miniInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    miniInfoText: {
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
    infoLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flex: 1,
      marginRight: spacing.md,
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
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
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
    },
    statValue: {
      marginTop: spacing.sm,
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
    },
    statLabel: {
      marginTop: spacing.xs,
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
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
      width: 40,
      height: 40,
      borderRadius: 12,
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
      marginTop: 2,
      fontSize: typography.sm,
      color: colors.textSecondary,
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
      <Card style={[styles.card, styles.profileCard]}>
        <View style={styles.avatarWrap}>
          <Ionicons name="person" size={42} color={colors.primary} />
        </View>

        <Text style={styles.name}>{displayName}</Text>

        {!!email && <Text style={styles.email}>{email}</Text>}

        {!!role && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{role}</Text>
          </View>
        )}

        <View style={styles.miniInfoWrap}>
          <View style={styles.miniInfoRow}>
            <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.miniInfoText}>{department}</Text>
          </View>

          <View style={styles.miniInfoRow}>
            <Ionicons name="briefcase-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.miniInfoText}>{jobTitle}</Text>
          </View>
        </View>
      </Card>

      <Card style={[styles.card, styles.infoCard]}>
        <Text style={styles.sectionTitle}>Informations personnelles</Text>

        <InfoRow icon="mail-outline" label="Email" value={email || "Non renseigné"} />
        <InfoRow icon="call-outline" label="Téléphone" value={phone} />
        <InfoRow icon="card-outline" label="ID Employé" value={String(employeeId)} />
      </Card>

      <Card style={[styles.card, styles.infoCard]}>
        <Text style={styles.sectionTitle}>Informations professionnelles</Text>

        <InfoRow icon="briefcase-outline" label="Poste" value={jobTitle} />
        <InfoRow icon="business-outline" label="Département" value={department} />
        <InfoRow icon="people-outline" label="Manager" value={managerName} />
        <InfoRow icon="calendar-outline" label="Date d’entrée" value={String(joinDate)} />
        <InfoRow icon="laptop-outline" label="Mode de travail" value={workMode} />
      </Card>

      <View>
        <Text style={styles.sectionTitle}>Aperçu rapide</Text>
        <View style={styles.statsRow}>
          <StatCard icon="airplane-outline" label="Congés restants" value="12" />
          <StatCard icon="time-outline" label="Demandes en attente" value="2" />
          <StatCard icon="desktop-outline" label="Desk du jour" value="A-12" />
        </View>
      </View>

      <Card style={[styles.card, styles.actionsCard]}>
        <Text style={styles.sectionTitle}>Paramètres</Text>

        <ActionRow
          icon="create-outline"
          title="Modifier le profil"
          subtitle="Mettre à jour vos informations"
          onPress={() => handleNavigate("EditProfile")}
        />

        <ActionRow
          icon="lock-closed-outline"
          title="Changer le mot de passe"
          subtitle="Sécuriser votre compte"
          onPress={() => handleNavigate("ChangePassword")}
        />

        <ActionRow
          icon={darkMode ? "moon" : "sunny-outline"}
          title="Apparence"
          subtitle={
            darkMode
              ? "Le mode sombre est activé"
              : "Le mode clair est activé"
          }
          onPress={toggleTheme}
        />

        <ActionRow
          icon="notifications-outline"
          title="Notifications"
          subtitle="Gérer vos préférences"
          onPress={() => handleNavigate("NotificationsSettings")}
        />
      </Card>

      <Card style={[styles.card, styles.actionsCard]}>
        <Text style={styles.sectionTitle}>Accès rapides</Text>

        {isEmployee && (
          <>
            <ActionRow
              icon="document-text-outline"
              title="Mes demandes"
              subtitle="Consulter vos demandes"
              onPress={() => handleNavigate("MyRequests")}
            />
            <ActionRow
              icon="calendar-clear-outline"
              title="Mes congés"
              subtitle="Voir vos demandes de congé"
              onPress={() => handleNavigate("LeaveRequests")}
            />
            <ActionRow
              icon="desktop-outline"
              title="Mes réservations"
              subtitle="Consulter vos desks réservés"
              onPress={() => handleNavigate("MyReservations")}
            />
          </>
        )}

        {isManager && (
          <>
            <ActionRow
              icon="checkmark-done-outline"
              title="Approbations"
              subtitle="Voir les demandes en attente"
              onPress={() => handleNavigate("Approvals")}
            />
            <ActionRow
              icon="people-outline"
              title="Mon équipe"
              subtitle="Gérer les membres de l’équipe"
              onPress={() => handleNavigate("TeamMembers")}
            />
          </>
        )}

        {isAdmin && (
          <>
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
            />
            <ActionRow
              icon="checkmark-circle-outline"
              title="Approbations comptes"
              subtitle="Valider les nouveaux utilisateurs"
              onPress={() => handleNavigate("AdminApprovals")}
            />
          </>
        )}
      </Card>

      <View style={styles.footer}>
        <Button
          title="Se déconnecter"
          variant="danger"
          onPress={handleSignOut}
        />
      </View>
    </ScrollView>
  );
};

export default ProfileScreen;