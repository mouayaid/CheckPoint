import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { RefreshControl } from "react-native";
import { Animated } from "react-native";

import { seatService } from "../services/api";
import { spacing, typography, borderRadius, shadows } from "../theme/theme";
import { Card, Button } from "../components";
import { useTheme } from "../context/ThemeContext";

const DashboardScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [myReservation, setMyReservation] = useState(null);

  const scaleAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    fetchMyReservation();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const fetchMyReservation = async () => {
    try {
      const response = await seatService.getMyTodayReservation();

      if (response.success && response.data) {
        setMyReservation(response.data);
      } else {
        setMyReservation(null);
      }
    } catch (error) {
      console.log("Dashboard reservation error", error);
      setMyReservation(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchMyReservation();
    } finally {
      setRefreshing(false);
    }
  };

  const seatLabel =
    myReservation?.seatLabel || myReservation?.SeatLabel || null;

  const today = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning 👋";
    if (hour < 18) return "Good afternoon 👋";
    return "Good evening 👋";
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },

    hero: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      marginBottom: spacing.xl,
      ...shadows.sm,
    },

    heroTitle: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: colors.textOnPrimary,
    },

    heroSubtitle: {
      marginTop: 4,
      fontSize: typography.sm,
      color: "rgba(255,255,255,0.85)",
    },

    card: {
      marginBottom: spacing.lg,
      backgroundColor: colors.surface,
    },

    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    cardTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.textPrimary,
    },

    seatLabel: {
      fontSize: 32,
      fontWeight: typography.bold,
      color: colors.primary,
    },

    leaveDays: {
      fontSize: 24,
      fontWeight: typography.bold,
      color: colors.primary,
    },

    cardSubtitle: {
      marginTop: 4,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    actionButton: {
      marginTop: spacing.md,
    },

    sectionTitle: {
      marginTop: spacing.sm,
      marginBottom: spacing.md,
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.textPrimary,
    },

    actionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },

    actionCard: {
      width: "47%",
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },

    actionText: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.textPrimary,
      textAlign: "center",
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{greeting}</Text>
        <Text style={styles.heroSubtitle}>{today}</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.cardRow}>
          <Ionicons name="desktop-outline" size={22} color={colors.primary} />
          <Text style={styles.cardTitle}>Today's Desk</Text>
        </View>

        {seatLabel ? (
          <>
            <Text style={styles.seatLabel}>{seatLabel}</Text>
            <Text style={styles.cardSubtitle}>Reserved for today</Text>
          </>
        ) : (
          <>
            <Text style={styles.cardSubtitle}>No desk reserved today</Text>
            <Button
              title="Reserve a desk"
              onPress={() => navigation.navigate("Desk")}
              style={styles.actionButton}
            />
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardRow}>
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          <Text style={styles.cardTitle}>Leave Balance</Text>
        </View>

        <Text style={styles.leaveDays}>18 days remaining</Text>
        <Text style={styles.cardSubtitle}>Manage your leave requests</Text>
      </Card>

      <Text style={styles.sectionTitle}>Quick actions</Text>

      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Desk")}
        >
          <Ionicons name="desktop-outline" size={28} color={colors.primary} />
          <Text style={styles.actionText}>Reserve desk</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Requests")}
        >
          <Ionicons name="calendar-outline" size={28} color={colors.primary} />
          <Text style={styles.actionText}>Request leave</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Rooms")}
        >
          <Ionicons name="business-outline" size={28} color={colors.primary} />
          <Text style={styles.actionText}>Rooms</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person-outline" size={28} color={colors.primary} />
          <Text style={styles.actionText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default DashboardScreen;
