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

/** Compact label for next event (backend may send date as ISO or display string). */
function formatEventCompact(event) {
  const raw = event?.date ?? event?.Date ?? event?.startDateTime ?? event?.StartDateTime;
  if (!raw) return "Date to be announced";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  const datePart = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timePart = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}

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
      const safe = Number.isNaN(balance) ? 0 : balance;

      setLeaveBalance(safe);
      const name = user?.fullName ?? user?.FullName ?? "";
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

  const heroDeskLine = loadingDesk
    ? "Checking your desk…"
    : seatLabel
      ? `Desk ${seatLabel} · reserved for today`
      : "No desk reserved yet — reserve below when you need one";

  const balanceKnown = leaveBalance !== null;
  const balanceNum = balanceKnown ? Number(leaveBalance) : NaN;
  const canRequestLeave =
    !loadingBalance && balanceKnown && !Number.isNaN(balanceNum) && balanceNum > 0;
  const noLeaveDaysLeft =
    !loadingBalance && balanceKnown && !Number.isNaN(balanceNum) && balanceNum <= 0;
  const balanceLoadFailed = !loadingBalance && leaveBalance === null;

  const showReserveDeskAction = !loadingDesk && !seatLabel;
  const showViewDeskAction = !loadingDesk && !!seatLabel;

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
            </Text>
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

        <View style={styles.heroStatusCard}>
          <Text style={styles.heroStatusLabel}>Today</Text>
          <Text style={styles.heroStatusText}>{heroDeskLine}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Your desk today</Text>

      <Card style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <Ionicons name="desktop-outline" size={20} color={colors.primary} />
          <Text style={styles.summaryTitle}>Workspace</Text>
        </View>

        {loadingDesk ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.summaryMuted}>Loading reservation…</Text>
          </View>
        ) : seatLabel ? (
          <>
            <View style={styles.successPill}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.success}
              />
              <Text style={styles.successPillText}>
                You&apos;re set — seat {seatLabel} for today
              </Text>
            </View>
            <Text style={styles.summarySubtitle}>
              Tap below to open the desk map or change if your office allows it.
            </Text>
            <Button
              title="Open desk map"
              variant="secondary"
              onPress={() => navigation.navigate("Desk")}
              style={styles.summaryButton}
            />
          </>
        ) : (
          <>
            <Text style={styles.summaryEmptyValue}>No reservation</Text>
            <Text style={styles.summarySubtitle}>
              Pick a seat on the map to work from the office today.
            </Text>
            <Button
              title="Reserve a desk"
              onPress={() => navigation.navigate("Desk")}
              style={styles.summaryButton}
            />
          </>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Leave balance</Text>

      <Card style={styles.infoCard}>
        <View style={styles.infoCardRow}>
          <View style={styles.infoIconWrap}>
            <Ionicons name="wallet-outline" size={20} color={colors.primary} />
          </View>

          <View style={styles.infoTextWrap}>
            <Text style={styles.infoTitle}>Annual leave</Text>

            {loadingBalance ? (
              <View style={styles.loadingInline}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.infoSubtitle}>Loading balance…</Text>
              </View>
            ) : balanceLoadFailed ? (
              <>
                <Text style={styles.infoSubtitle}>
                  Couldn&apos;t load your balance. Pull to refresh or open
                  leave requests to see your history.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.balanceValue}>
                  {balanceNum} {balanceNum === 1 ? "day" : "days"} left
                </Text>
                <Text style={styles.infoSubtitle}>
                  {canRequestLeave
                    ? "You can submit a new leave request."
                    : noLeaveDaysLeft
                      ? "No days left to book — you can still view past requests."
                      : ""}
                </Text>
              </>
            )}
          </View>
        </View>

        {canRequestLeave && (
          <Button
            title="Request leave"
            onPress={() => navigation.navigate("Requests")}
            style={styles.infoButton}
          />
        )}

        {noLeaveDaysLeft && (
          <>
            <Text style={styles.balanceWarningTextSmall}>
              You have no remaining leave days for new bookings.
            </Text>
            <Button
              title="View leave history"
              variant="secondary"
              onPress={() => navigation.navigate("Requests")}
              style={styles.infoButton}
            />
          </>
        )}

        {balanceLoadFailed && (
          <Button
            title="Open leave requests"
            variant="secondary"
            onPress={() => navigation.navigate("Requests")}
            style={styles.infoButton}
          />
        )}
      </Card>

      <Text style={styles.sectionTitle}>Next event</Text>

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
            {loadingEvent ? (
              <View style={styles.loadingInline}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.infoSubtitle}>Loading calendar…</Text>
              </View>
            ) : upcomingEvent ? (
              <>
                <Text style={styles.eventTitle} numberOfLines={2}>
                  {upcomingEvent.title ??
                    upcomingEvent.Title ??
                    "Untitled event"}
                </Text>
                <Text style={styles.eventCompact}>
                  {formatEventCompact(upcomingEvent)}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.infoTitle}>Nothing scheduled</Text>
                <Text style={styles.infoSubtitle}>
                  No events in the next 7 days. Check the Events tab for more.
                </Text>
              </>
            )}
          </View>
        </View>

        <Button
          title={upcomingEvent ? "All events" : "Browse events"}
          variant={upcomingEvent ? "secondary" : "primary"}
          onPress={() => navigation.navigate("Events")}
          style={styles.infoButton}
        />
      </Card>

      <Text style={styles.sectionTitle}>Quick actions</Text>
      <Text style={styles.sectionHint}>
        Shortcuts based on what you can do right now.
      </Text>

      <View style={styles.actionsGrid}>
        {showReserveDeskAction && (
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.88}
            onPress={() => navigation.navigate("Desk")}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons
                name="desktop-outline"
                size={24}
                color={colors.primary}
              />
            </View>
            <Text style={styles.actionText}>Reserve desk</Text>
            <Text style={styles.actionSubtext}>
              Choose a seat for today
            </Text>
          </TouchableOpacity>
        )}

        {showViewDeskAction && (
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.88}
            onPress={() => navigation.navigate("Desk")}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="map-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.actionText}>View desk</Text>
            <Text style={styles.actionSubtext}>
              Seat {seatLabel} · open map
            </Text>
          </TouchableOpacity>
        )}

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
            Reserve a meeting room
          </Text>
        </TouchableOpacity>

        {canRequestLeave && (
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.88}
            onPress={() => navigation.navigate("Requests")}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons
                name="calendar-outline"
                size={24}
                color={colors.primary}
              />
            </View>
            <Text style={styles.actionText}>Request leave</Text>
            <Text style={styles.actionSubtext}>
              {balanceNum} {balanceNum === 1 ? "day" : "days"} available
            </Text>
          </TouchableOpacity>
        )}
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
      marginTop: spacing.sm,
      fontSize: typography.xs,
      color: colors.warning,
      fontWeight: typography.semibold,
    },

    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: spacing.md,
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
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.textOnPrimary,
      lineHeight: 20,
    },

    sectionTitle: {
      marginBottom: spacing.xs,
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },

    sectionHint: {
      marginBottom: spacing.md,
      fontSize: typography.xs,
      color: colors.textSecondary,
    },

    summaryCard: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      marginBottom: spacing.xl,
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
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
    },

    summarySubtitle: {
      marginTop: spacing.sm,
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    summaryMuted: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    summaryButton: {
      marginTop: spacing.md,
    },

    successPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.successLight,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      alignSelf: "flex-start",
    },

    successPillText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.success,
      flex: 1,
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

    eventTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: 4,
    },

    eventCompact: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      fontWeight: typography.medium,
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
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
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
