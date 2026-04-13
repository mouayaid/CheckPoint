import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { seatService, profileService, eventService } from "../services/api";
import { Card, Button } from "../components";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api/axiosInstance";
import { useAuth } from "../context/AuthContext";

function formatEventCompact(event) {
  const raw =
    event?.date ?? event?.Date ?? event?.startDateTime ?? event?.StartDateTime;

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
  const { user } = useAuth();

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

  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [pendingUserCount, setPendingUserCount] = useState(0);
  const [loadingPendingLeave, setLoadingPendingLeave] = useState(true);
  const [loadingPendingUsers, setLoadingPendingUsers] = useState(true);

  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  const normalizeRole = (role) => {
    if (typeof role === "string") return role.trim().toLowerCase();
    if (typeof role === "number") return role;
    return null;
  };

  const role = normalizeRole(user?.role);

  const isAdmin = role === "admin" || role === 3;
  const isHr = role === "hr" || role === 4;
  const canReviewLeave =
    role === "hr" || role === "admin" || role === 4 || role === 3;
  const heroFadeAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(heroFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
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

  const fetchPendingLeaveApprovals = async () => {
    if (!canReviewLeave) {
      setLoadingPendingLeave(false);
      setPendingLeaveCount(0);
      return;
    }

    setLoadingPendingLeave(true);

    try {
      const res = await api.get("/Leave/pending-review");
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setPendingLeaveCount(data.length);
    } catch (error) {
      console.log("Pending leave approvals error", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      setPendingLeaveCount(0);
    } finally {
      setLoadingPendingLeave(false);
    }
  };

  const fetchPendingUserApprovals = async () => {
    if (!isAdmin) {
      setLoadingPendingUsers(false);
      setPendingUserCount(0);
      return;
    }

    setLoadingPendingUsers(true);

    try {
      const res = await api.get("/admin/users/pending");
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setPendingUserCount(data.length);
    } catch (error) {
      console.log("Pending user approvals error", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
      });
      setPendingUserCount(0);
    } finally {
      setLoadingPendingUsers(false);
    }
  };

  const fetchLeaveBalance = async () => {
    setLoadingBalance(true);

    try {
      const response = await profileService.getProfile();

      const payload = response?.data?.data || response?.data || null;

      const profileUser =
        payload?.user ??
        payload?.User ??
        payload?.userDto ??
        payload?.UserDto ??
        payload ??
        null;

      const rawBalance =
        profileUser?.leaveBalance ??
        profileUser?.LeaveBalance ??
        payload?.leaveBalance ??
        payload?.LeaveBalance ??
        0;

      const balance = Number(rawBalance);
      const safeBalance = Number.isNaN(balance) ? 0 : balance;

      setLeaveBalance(safeBalance);

      const name =
        profileUser?.fullName ??
        profileUser?.FullName ??
        payload?.fullName ??
        payload?.FullName ??
        "";

      setUserName(name);
    } catch (error) {
      console.log("Leave balance error", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
      });

      setLeaveBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true);

    try {
      const res = await api.get("/Announcement");
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setAnnouncements(data);
    } catch (error) {
      console.log("Announcements error", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
      });
      setAnnouncements([]);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const fetchMyReservation = async () => {
    setLoadingDesk(true);

    try {
      const response = await seatService.getMyTodayReservation();
      const reservation = response?.data?.data || response?.data || null;
      setMyReservation(reservation || null);
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
      fetchPendingLeaveApprovals(),
      fetchPendingUserApprovals(),
      fetchAnnouncements(),
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
      ? `Desk ${seatLabel} reserved for today`
      : "No desk reserved yet for today";

  const balanceKnown = leaveBalance !== null;
  const balanceNum = balanceKnown ? Number(leaveBalance) : NaN;
  const noLeaveDaysLeft =
    !loadingBalance &&
    balanceKnown &&
    !Number.isNaN(balanceNum) &&
    balanceNum <= 0;
  const balanceLoadFailed = !loadingBalance && leaveBalance === null;

  const showLeaveApprovalsCard =
    canReviewLeave && !loadingPendingLeave && pendingLeaveCount > 0;

  const showAdminApprovalsCard =
    isAdmin && !loadingPendingUsers && pendingUserCount > 0;

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
      <Animated.View
        style={{
          opacity: heroFadeAnim,
          transform: [
            {
              translateY: heroFadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        }}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
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
        </LinearGradient>
      </Animated.View>

      <Animated.View
        style={{
          opacity: contentFadeAnim,
          transform: [
            {
              translateY: contentFadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        }}
      >
        <Text style={styles.sectionTitle}>Workspace</Text>

        <Card style={styles.primaryCard}>
          <View style={styles.summaryTopRow}>
            <Ionicons name="desktop-outline" size={20} color={colors.primary} />
            <Text style={styles.summaryTitle}>Your desk today</Text>
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
                  Seat {seatLabel} is reserved for today
                </Text>
              </View>

              <Text style={styles.summarySubtitle}>
                Open the desk map to view your reservation.
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
                Pick a seat on the map if you plan to work from the office
                today.
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
              <Ionicons
                name="wallet-outline"
                size={20}
                color={colors.primary}
              />
            </View>

            <View style={styles.infoTextWrap}>
              {loadingBalance ? (
                <View style={styles.loadingInline}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.infoSubtitle}>Loading balance…</Text>
                </View>
              ) : balanceLoadFailed ? (
                <Text style={styles.infoSubtitle}>
                  Couldn&apos;t load your leave balance right now. Pull to
                  refresh.
                </Text>
              ) : (
                <>
                  <Text style={styles.balanceValue}>
                    {balanceNum} {balanceNum === 1 ? "day" : "days"} left
                  </Text>

                  <Text style={styles.infoSubtitle}>
                    {balanceNum > 0
                      ? "You can submit a new leave request or review your previous requests."
                      : "You have no leave days left. You can still review your previous requests."}
                  </Text>

                  {noLeaveDaysLeft && (
                    <Text style={styles.balanceWarningTextSmall}>
                      You currently have no remaining leave days.
                    </Text>
                  )}

                  <Button
                    title={
                      balanceNum > 0
                        ? "Create leave request"
                        : "View previous requests"
                    }
                    variant={balanceNum > 0 ? "primary" : "secondary"}
                    onPress={() =>
                      navigation.navigate("LeaveRequest", {
                        openCreateModal: balanceNum > 0,
                      })
                    }
                    style={styles.infoButton}
                  />
                </>
              )}
            </View>
          </View>
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
                    No events in the next 7 days.
                  </Text>
                </>
              )}
            </View>
          </View>

          <Button
            title="Browse events"
            variant={upcomingEvent ? "secondary" : "primary"}
            onPress={() => navigation.navigate("Events")}
            style={styles.infoButton}
          />
        </Card>

        <Text style={styles.sectionTitle}>Announcements</Text>

        <Card style={styles.infoCard}>
          <View style={styles.infoCardRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons
                name="megaphone-outline"
                size={20}
                color={colors.primary}
              />
            </View>

            <View style={styles.infoTextWrap}>
              {loadingAnnouncements ? (
                <View style={styles.loadingInline}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.infoSubtitle}>
                    Loading announcements…
                  </Text>
                </View>
              ) : announcements.length > 0 ? (
                <>
                  <Text style={styles.infoTitle}>
                    {announcements[0]?.title ??
                      announcements[0]?.Title ??
                      "Announcement"}
                  </Text>

                  <Text style={styles.infoSubtitle}>
                    {(
                      announcements[0]?.content ??
                      announcements[0]?.Content ??
                      ""
                    ).length > 140
                      ? `${(
                          announcements[0]?.content ??
                          announcements[0]?.Content ??
                          ""
                        ).slice(0, 140)}...`
                      : (announcements[0]?.content ??
                        announcements[0]?.Content ??
                        "")}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.infoTitle}>Company news</Text>
                  <Text style={styles.infoSubtitle}>
                    No announcements available right now.
                  </Text>
                </>
              )}
            </View>
          </View>

          {(isHr || isAdmin) && (
            <Button
              title="Manage announcements"
              icon="megaphone-outline"
              variant="primary"
              onPress={() => navigation.navigate("ManageAnnouncements")}
              style={styles.infoButton}
            />
          )}
        </Card>
      </Animated.View>
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
      fontFamily: typography.fontFamily?.bold,
      color: colors.textOnPrimary,
    },

    heroSubtitle: {
      marginTop: 4,
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
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
      fontFamily: typography.fontFamily?.semibold,
      color: colors.textOnPrimary,
      opacity: 0.85,
      marginBottom: 4,
    },

    heroStatusText: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.medium,
      color: colors.textOnPrimary,
      lineHeight: 20,
    },

    sectionTitle: {
      marginBottom: spacing.xs,
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
    },

    primaryCard: {
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
      fontSize: typography.lg,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
    },

    summaryEmptyValue: {
      fontSize: typography.lg,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
    },

    summarySubtitle: {
      marginTop: spacing.sm,
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
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
      fontFamily: typography.fontFamily?.semibold,
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

    attentionCard: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
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

    attentionIconWrap: {
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
      fontSize: typography.lg,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      marginBottom: 4,
    },

    balanceValue: {
      fontSize: 32,
      fontFamily: typography.fontFamily?.bold,
      color: colors.primary,
      marginTop: 2,
    },

    infoSubtitle: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    balanceWarningTextSmall: {
      marginTop: spacing.sm,
      fontSize: typography.xs,
      color: colors.warning,
      fontWeight: typography.semibold,
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
  });

export default DashboardScreen;
