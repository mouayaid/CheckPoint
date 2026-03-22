import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { seatService, profileService, eventService } from "../services/api";
import { Card, Button } from "../components";
import { useTheme } from "../context/ThemeContext";

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingDesk, setLoadingDesk] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);

  const [myReservation, setMyReservation] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);

  const [userName, setUserName] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const formatDateForApi = (date) => {
    return date.toISOString().split("T")[0];
  };

  const fetchUpcomingEvent = async () => {
    setLoadingEvent(true);

    try {
      const today = new Date();
      let foundEvent = null;

      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);

        const formattedDate = formatDateForApi(checkDate);
        const response = await eventService.getEventsByDate(formattedDate);

        const events = response?.data || [];

        if (events.length > 0) {
          foundEvent = events[0];
          break;
        }
      }

      setUpcomingEvent(foundEvent);
    } catch (error) {
      console.log("Upcoming event error", error);
      setUpcomingEvent(null);
    } finally {
      setLoadingEvent(false);
    }
  };

  const fetchLeaveBalance = async () => {
    setLoadingBalance(true);
    try {
      const response = await profileService.getProfile();

      const user = response?.data?.user || null;

      const rawBalance = user?.leaveBalance ?? user?.LeaveBalance ?? 0;
      const balance = Number(rawBalance);

      setLeaveBalance(Number.isNaN(balance) ? 0 : balance);
      const name = user?.fullName ?? user?.FullName ?? "";

      setLeaveBalance(balance);
      setUserName(name);
    } catch (error) {
      console.log("Leave balance error", error);
      setLeaveBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  const fetchMyReservation = async () => {
    setLoadingDesk(true);
    try {
      const response = await seatService.getMyTodayReservation();

      const reservation = response?.data?.data || response?.data || null;

      if (reservation) {
        setMyReservation(reservation);
      } else {
        setMyReservation(null);
      }
    } catch (error) {
      console.log("Dashboard reservation error", error);
      setMyReservation(null);
    } finally {
      setLoadingDesk(false);
    }
  };

  const loadDashboardData = async () => {
    await Promise.all([
      fetchMyReservation(),
      fetchLeaveBalance(),
      fetchUpcomingEvent(),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  };

  const seatLabel =
    myReservation?.seatLabel || myReservation?.SeatLabel || null;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning 👋"
      : hour < 18
        ? "Good afternoon 👋"
        : "Good evening 👋";

  const heroStatus = loadingDesk
    ? "Checking your desk for today..."
    : seatLabel
      ? `Your desk today: ${seatLabel}`
      : "You do not have a desk reservation yet";

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
        <View style={styles.heroTopRow}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>
              {greeting}
              {userName ? `, ${userName.split(" ")[0]}` : ""}
            </Text>{" "}
            <Text style={styles.heroSubtitle}>{today}</Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons
              name="sparkles-outline"
              size={22}
              color={colors.textOnPrimary}
            />
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Overview</Text>

      <View style={styles.summaryGrid}>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <Ionicons name="desktop-outline" size={20} color={colors.primary} />
            <Text style={styles.summaryTitle}>Today's Desk</Text>
          </View>

          {loadingDesk ? (
            <View style={styles.loadingInline}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.summaryMuted}>Checking reservation...</Text>
            </View>
          ) : seatLabel ? (
            <>
              <Text style={styles.summaryValue}>{seatLabel}</Text>
              <Text style={styles.summarySubtitle}>Reserved for today</Text>
              <Button
                title="Open desk view"
                onPress={() => navigation.navigate("Desk")}
                style={styles.summaryButton}
              />
            </>
          ) : (
            <>
              <Text style={styles.summaryEmptyValue}>No desk</Text>
              <Text style={styles.summarySubtitle}>
                Reserve your workspace for today
              </Text>
              <Button
                title="Reserve a desk"
                onPress={() => navigation.navigate("Desk")}
                style={styles.summaryButton}
              />
            </>
          )}
        </Card>
      </View>

      <Card style={styles.infoCard}>
        <View style={styles.infoCardRow}>
          <View style={styles.infoIconWrap}>
            <Ionicons name="wallet-outline" size={20} color={colors.primary} />
          </View>

          <View style={styles.infoTextWrap}>
            <Text style={styles.infoTitle}>Leave Balance</Text>

            {loadingBalance ? (
              <View style={styles.loadingInline}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.infoSubtitle}>Loading balance...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.balanceValue}>
                  {leaveBalance ?? "--"} days
                </Text>
                <Text style={styles.infoSubtitle}>Available leave days</Text>
              </>
            )}
          </View>
        </View>

        <Button
          title={
            Number(leaveBalance) > 0
              ? "Go to leave requests"
              : "View leave history"
          }
          onPress={() => navigation.navigate("Requests")}
          style={styles.infoButton}
        />
        {!loadingBalance && Number(leaveBalance) <= 0 && (
          <Text style={styles.balanceWarningTextSmall}>
            You have no remaining leave days.
          </Text>
        )}
      </Card>

      <Card style={styles.infoCard}>
        <View style={styles.infoCardRow}>
          <View style={styles.infoIconWrap}>
            <Ionicons
              name="calendar-clear-outline"
              size={20}
              color={colors.primary}
            />
          </View>

          <View style={styles.infoTextWrap}>
            <Text style={styles.infoTitle}>Upcoming Event</Text>

            {loadingEvent ? (
              <View style={styles.loadingInline}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.infoSubtitle}>Loading events...</Text>
              </View>
            ) : upcomingEvent ? (
              <>
                <Text style={styles.eventTitle}>
                  {upcomingEvent.title ??
                    upcomingEvent.Title ??
                    "Untitled event"}
                </Text>
                <Text style={styles.infoSubtitle}>
                  {upcomingEvent.date ?? upcomingEvent.Date ?? "Upcoming soon"}
                </Text>
              </>
            ) : (
              <Text style={styles.infoSubtitle}>No upcoming events</Text>
            )}
          </View>
        </View>

        <Button
          title="View events"
          onPress={() => navigation.navigate("Events")}
          style={styles.infoButton}
        />
      </Card>

      <Text style={styles.sectionTitle}>Quick actions</Text>

      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.88}
          onPress={() => navigation.navigate("Desk")}
        >
          <View style={styles.actionIconWrap}>
            <Ionicons name="desktop-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.actionText}>Reserve desk</Text>
          <Text style={styles.actionSubtext}>
            Book your workspace for today
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.88}
          onPress={() => navigation.navigate("Rooms")}
        >
          <View style={styles.actionIconWrap}>
            <Ionicons
              name="business-outline"
              size={24}
              color={colors.primary}
            />
          </View>
          <Text style={styles.actionText}>Book room</Text>
          <Text style={styles.actionSubtext}>
            Reserve a meeting room quickly
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
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
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      marginBottom: spacing.xl,
      ...shadows.sm,
    },

    balanceWarningTextSmall: {
      marginTop: 6,
      fontSize: typography.xs,
      color: colors.warning,
      fontWeight: typography.semibold,
    },

    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: spacing.lg,
      gap: spacing.md,
    },

    heroTextWrap: {
      flex: 1,
    },

    heroTitle: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: colors.textOnPrimary,
    },

    heroSubtitle: {
      marginTop: 4,
      fontSize: typography.sm,
      color: colors.textOnPrimary,
      opacity: 0.88,
    },

    heroIconWrap: {
      width: 42,
      height: 42,
      borderRadius: borderRadius.full,
      backgroundColor: "rgba(255,255,255,0.14)",
      alignItems: "center",
      justifyContent: "center",
    },

    heroStatusCard: {
      backgroundColor: "rgba(255,255,255,0.14)",
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },

    heroStatusLabel: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: colors.textOnPrimary,
      opacity: 0.85,
      marginBottom: 4,
    },

    heroStatusText: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.textOnPrimary,
    },

    sectionTitle: {
      marginBottom: spacing.md,
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },

    summaryGrid: {
      gap: spacing.lg,
      marginBottom: spacing.lg,
    },

    summaryCard: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
    },

    summaryTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    summaryTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },

    summaryValue: {
      fontSize: 32,
      fontWeight: typography.bold,
      color: colors.primary,
    },

    summaryEmptyValue: {
      fontSize: 24,
      fontWeight: typography.bold,
      color: colors.text,
    },

    summarySubtitle: {
      marginTop: 4,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    summaryMuted: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    summaryButton: {
      marginTop: spacing.md,
    },

    loadingInline: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    infoCard: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },

    infoCardRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
    },

    infoIconWrap: {
      width: 42,
      height: 42,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },

    infoTextWrap: {
      flex: 1,
    },

    infoTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: 4,
    },

    balanceValue: {
      fontSize: 28,
      fontWeight: typography.bold,
      color: colors.primary,
      marginTop: 2,
    },

    infoSubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    infoButton: {
      marginTop: spacing.md,
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
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },

    actionIconWrap: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },

    actionText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
      textAlign: "center",
    },

    actionSubtext: {
      marginTop: 4,
      fontSize: typography.xs,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 18,
    },
  });

export default DashboardScreen;
