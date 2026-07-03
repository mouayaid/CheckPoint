import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, Card } from "../";
import { useTheme } from "../../context/ThemeContext";

const SectionHeader = ({ title, styles }) => {
  return <Text style={styles.sectionTitle}>{title}</Text>;
};

const CardHeader = ({ icon, title, styles, colors }) => {
  return (
    <View style={styles.cardHeader}>
      <View
        style={[
          styles.cardHeaderIconWrap,
          { backgroundColor: colors.primaryLight ?? `${colors.primary}18` },
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>

      <Text style={styles.cardHeaderTitle}>{title}</Text>
    </View>
  );
};

const AdminActionCard = ({
  icon,
  title,
  description,
  buttonTitle,
  onPress,
  styles,
  colors,
}) => {
  return (
    <Card style={styles.adminActionCard}>
      <View style={styles.adminActionTop}>
        <View style={styles.adminActionIcon}>
          <Ionicons name={icon} size={21} color={colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.adminActionTitle}>{title}</Text>
          <Text style={styles.adminActionDesc}>{description}</Text>
        </View>
      </View>

      <Button
        title={buttonTitle}
        variant="primary"
        onPress={onPress}
        style={styles.cardBtn}
      />
    </Card>
  );
};

const QuickActions = ({ isAdmin, isManager, navigation }) => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius),
    [colors, spacing, typography, borderRadius],
  );

  if (isAdmin) {
    return (
      <>
        <AdminActionCard
          icon="library-outline"
          title="Réserver une salle"
          description="Consultez les créneaux disponibles et réservez instantanément une salle pour une réunion."
          buttonTitle="Réserver une salle"
          onPress={() => navigation.navigate("Rooms")}
          styles={styles}
          colors={colors}
        />

        <AdminActionCard
          icon="people-outline"
          title="Gestion des utilisateurs"
          description="Consultez les utilisateurs, modifiez leurs informations, attribuez des rôles ou supprimez des comptes."
          buttonTitle="Gérer les utilisateurs"
          onPress={() => navigation.navigate("UserManagement")}
          styles={styles}
          colors={colors}
        />

        <AdminActionCard
          icon="business-outline"
          title="Gestion des salles"
          description="Gérez les salles de réunion, leur capacité et leur disponibilité."
          buttonTitle="Gérer les salles"
          onPress={() => navigation.navigate("RoomManagement")}
          styles={styles}
          colors={colors}
        />

        <AdminActionCard
          icon="desktop-outline"
          title="Gestion des sièges et tables"
          description="Organisez la disposition des tables et des sièges dans l’espace de travail."
          buttonTitle="Gérer les sièges"
          onPress={() => navigation.navigate("SeatManagement")}
          styles={styles}
          colors={colors}
        />
      </>
    );
  }

  return (
    <>
      <SectionHeader title="Demandes" styles={styles} />
      <Card style={styles.card}>
        <CardHeader
          icon="albums-outline"
          title="Demandes"
          styles={styles}
          colors={colors}
        />
        <Text style={styles.cardEmptyTitle}>Choisir une demande</Text>
        <Text style={styles.cardBody}>
          Congé, sortie, récupération, télétravail ou documents.
        </Text>
        <Button
          testID="dashboard.demandsButton"
          title="Demandes"
          variant="primary"
          onPress={() => navigation.navigate("DemandMenu")}
          style={styles.cardBtn}
        />
      </Card>

      <SectionHeader title="Espace de travail" styles={styles} />
      <Card style={styles.card}>
        <CardHeader
          icon="desktop-outline"
          title="Réserver un bureau"
          styles={styles}
          colors={colors}
        />
        <Text style={styles.cardEmptyTitle}>Gérez vos présences</Text>
        <Text style={styles.cardBody}>
          Consultez les disponibilités et réservez un bureau pour votre journée
          de travail en présentiel.
        </Text>
        <Button
          testID="dashboard.reserveDeskButton"
          title="Réserver un bureau"
          variant="primary"
          onPress={() => navigation.navigate("Desk")}
          style={styles.cardBtn}
        />
      </Card>

      {isManager && (
        <Card style={styles.card}>
          <CardHeader
            icon="library-outline"
            title="Réserver une salle"
            styles={styles}
            colors={colors}
          />
          <Text style={styles.cardEmptyTitle}>Réunions et salles</Text>
          <Text style={styles.cardBody}>
            Consultez les disponibilités et réservez instantanément une salle.
          </Text>
          <Button
            title="Réserver une salle"
            variant="primary"
            onPress={() => navigation.navigate("Rooms")}
            style={styles.cardBtn}
          />
        </Card>
      )}
    </>
  );
};

const createStyles = (colors, spacing, typography, borderRadius) =>
  StyleSheet.create({
    sectionTitle: {
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.bold,
      color: colors.textSecondary,
      letterSpacing: 0.7,
      textTransform: "uppercase",
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },

    card: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },

    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    cardHeaderIconWrap: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
    },

    cardHeaderTitle: {
      flex: 1,
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
    },

    cardEmptyTitle: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    cardBody: {
      marginTop: spacing.xs,
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    cardBtn: {
      marginTop: spacing.md,
    },

    adminActionCard: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },

    adminActionTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
    },

    adminActionIcon: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.primaryLight ?? `${colors.primary}18`,
      alignItems: "center",
      justifyContent: "center",
    },

    adminActionTitle: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      marginBottom: 4,
    },

    adminActionDesc: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });

export default QuickActions;
