import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Pressable,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

import {
  seatService,
  profileService,
  eventService,
  leaveService,
  requestService,
  adminUserService,
} from "../services/api";
import api from "../services/api/axiosInstance";
import { Card, Button } from "../components";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

/* ----------------------------- Helper functions ---------------------------- */

const getResponseData = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.items)) return response.items;
  return response?.data?.data ?? response?.data ?? response ?? [];
};

const normalizeRole = (role) => {
  if (typeof role === "string") return role.trim().toLowerCase();
  if (typeof role === "number") return role;
  return null;
};

const getRoleFlags = (role) => {
  const normalized = normalizeRole(role);

  return {
    role: normalized,
    isAdmin: normalized === "admin" || normalized === 3,
    isManager: normalized === "manager" || normalized === 2,
    canReviewLeave: normalized === "admin" || normalized === 3,
  };
};

const formatDateForApi = (date) => date.toISOString().split("T")[0];

const getEventId = (event, index) => event?.id ?? event?.Id ?? `event-${index}`;

const getEventTitle = (event) =>
  event?.title ?? event?.Title ?? "Événement sans titre";

const getEventDescription = (event) =>
  event?.description ?? event?.Description ?? "";

const getEventImage = (event) => event?.imageUrl ?? event?.ImageUrl ?? null;

const getEventLocation = (event) =>
  event?.location ??
  event?.Location ??
  event?.roomName ??
  event?.RoomName ??
  null;

const getEventStartValue = (event) =>
  event?.startDateTime ?? event?.StartDateTime ?? event?.date ?? event?.Date;

const getEventEndValue = (event) =>
  event?.endDateTime ?? event?.EndDateTime ?? getEventStartValue(event);

const getEventStartTime = (event) => {
  const raw = getEventStartValue(event);
  if (!raw) return 0;

  const timestamp = new Date(raw).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getEventEndTime = (event) => {
  const raw = getEventEndValue(event);
  if (!raw) return getEventStartTime(event);

  const timestamp = new Date(raw).getTime();
  return Number.isNaN(timestamp) ? getEventStartTime(event) : timestamp;
};

const formatEventDateTime = (event) => {
  const startRaw = getEventStartValue(event);
  if (!startRaw) return "Date à confirmer";

  const start = new Date(startRaw);
  if (Number.isNaN(start.getTime())) return "Date à confirmer";

  const endRaw = getEventEndValue(event);
  const end = endRaw ? new Date(endRaw) : null;

  const datePart = start.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const startTime = start.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const endTime =
    end && !Number.isNaN(end.getTime())
      ? end.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return endTime ? `${datePart} · ${startTime} - ${endTime}` : `${datePart} · ${startTime}`;
};

const isEventImportant = (event) => {
  const isImportant = event?.isImportant ?? event?.IsImportant ?? false;
  if (isImportant === true) return true;
  if (typeof isImportant === "string") {
    return ["true", "important", "urgent", "high"].includes(
      isImportant.trim().toLowerCase(),
    );
  }

  const priority = event?.priority ?? event?.Priority;
  if (typeof priority === "number") return priority > 0;
  if (typeof priority === "string") {
    return ["important", "urgent", "high", "haute", "elevee", "élevée"].includes(
      priority.trim().toLowerCase(),
    );
  }

  return event?.isMandatory === true || event?.IsMandatory === true;
};

const sortEventsNearestFirst = (events) =>
  [...events].sort((a, b) => getEventStartTime(a) - getEventStartTime(b));

const filterUpcomingEvents = (events) => {
  const now = Date.now();
  return events.filter((event) => getEventEndTime(event) >= now);
};

const getDisplayName = (payload) => {
  const profileUser =
    payload?.user ??
    payload?.User ??
    payload?.userDto ??
    payload?.UserDto ??
    payload ??
    null;

  return (
    profileUser?.fullName ??
    profileUser?.FullName ??
    payload?.fullName ??
    payload?.FullName ??
    ""
  );
};

const getLeaveBalanceValue = (payload) => {
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
  return Number.isNaN(balance) ? 0 : balance;
};

const isCheckedInEntry = (entry) => {
  const status = entry?.status ?? entry?.Status;

  if (typeof status === "number") return status === 2;

  if (typeof status === "string") {
    const normalized = status.trim().toLowerCase();
    return normalized === "checkedin" || normalized === "checked_in";
  }

  return false;
};

const buildAttendanceSummary = (monthCheckIns, currentYear, currentMonth) => {
  const today = new Date();
  const year = currentYear;
  const monthIndex = currentMonth - 1;
  const daysInMonth = new Date(year, currentMonth, 0).getDate();

  const checkInMap = {};
  monthCheckIns.forEach((item) => {
    const rawDate = item?.date ?? item?.Date;
    if (!rawDate) return;
    checkInMap[String(rawDate).split("T")[0]] = item;
  });

  let checkedInCount = 0;
  let missedCount = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, monthIndex, day);
    if (dateObj > today) continue;

    const dateStr = `${year}-${String(currentMonth).padStart(2, "0")}-${String(
      day,
    ).padStart(2, "0")}`;

    const entry = checkInMap[dateStr];

    if (isCheckedInEntry(entry)) {
      checkedInCount += 1;
    } else if (dateObj.toDateString() !== today.toDateString()) {
      missedCount += 1;
    }
  }

  const recentDays = [];
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date();
    d.setDate(today.getDate() - offset);

    const isSameMonth = d.getFullYear() === year && d.getMonth() === monthIndex;

    if (!isSameMonth) {
      recentDays.push({
        key: `outside-${offset}`,
        label: "",
        type: "empty",
      });
      continue;
    }

    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(d.getDate()).padStart(2, "0")}`;

    const entry = checkInMap[dateStr];
    const isToday = d.toDateString() === today.toDateString();

    let type = "today";
    if (isCheckedInEntry(entry)) type = "checked";
    else if (!isToday) type = "missed";

    recentDays.push({
      key: dateStr,
      label: String(d.getDate()),
      type,
    });
  }

  const todayStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return {
    checkedInCount,
    missedCount,
    recentDays,
    checkedInToday: isCheckedInEntry(checkInMap[todayStr]),
  };
};

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return { greeting: "Bonjour", emoji: "🌅" };
  if (hour < 18) return { greeting: "Bon après-midi", emoji: "👋" };

  return { greeting: "Bonsoir", emoji: "🌙" };
};

const getAnnouncementId = (announcement, index) =>
  announcement?.id ?? announcement?.Id ?? `announcement-${index}`;

const getAnnouncementTitle = (announcement) =>
  announcement?.title ?? announcement?.Title ?? "Annonce";

const getAnnouncementContent = (announcement) =>
  announcement?.content ?? announcement?.Content ?? "";

const getAnnouncementImage = (announcement) =>
  announcement?.imageUrl ?? announcement?.ImageUrl ?? null;

const getAnnouncementDateValue = (announcement) =>
  announcement?.dateCreation ??
  announcement?.createdAt ??
  announcement?.DateCreation ??
  announcement?.CreatedAt ??
  null;

const isAnnouncementImportant = (announcement) => {
  const isImportant =
    announcement?.isImportant ?? announcement?.IsImportant ?? false;

  if (isImportant === true) return true;
  if (typeof isImportant === "string") {
    return ["true", "important", "urgent", "high"].includes(
      isImportant.trim().toLowerCase(),
    );
  }

  const priority = announcement?.priority ?? announcement?.Priority;
  if (typeof priority === "number") return priority > 0;
  if (typeof priority === "string") {
    return ["important", "urgent", "high", "haute", "elevee", "élevée"].includes(
      priority.trim().toLowerCase(),
    );
  }

  return false;
};

const getAnnouncementTime = (announcement) => {
  const raw = getAnnouncementDateValue(announcement);
  if (!raw) return 0;

  const timestamp = new Date(raw).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatAnnouncementDate = (announcement) => {
  const raw = getAnnouncementDateValue(announcement);
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const sortAnnouncementsNewestFirst = (items) =>
  [...items].sort((a, b) => getAnnouncementTime(b) - getAnnouncementTime(a));

const truncateAnnouncement = (text, maxLength = 132) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
};

/* -------------------------------- UI pieces ------------------------------- */

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

const StatusChip = ({ text, dotColor, styles }) => {
  return (
    <View style={styles.heroChip}>
      <View style={[styles.heroChipDot, { backgroundColor: dotColor }]} />
      <Text style={styles.heroChipText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
};

const AdminStatChip = ({
  label,
  count,
  loading,
  badgeText,
  onPress,
  styles,
  colors,
}) => {
  return (
    <Pressable style={styles.adminChip} onPress={onPress}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Text style={styles.adminChipNum}>{count}</Text>
      )}

      <Text style={styles.adminChipLabel}>{label}</Text>

      {!loading && count > 0 && badgeText ? (
        <View style={styles.adminChipBadge}>
          <Text style={styles.adminChipBadgeText}>{badgeText}</Text>
        </View>
      ) : null}
    </Pressable>
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

/* ------------------------------ Main screen ------------------------------- */

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const { user, refreshFlag } = useAuth();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const { isAdmin, isManager, canReviewLeave } = useMemo(
    () => getRoleFlags(user?.roleName ?? user?.roleId),
    [user?.roleName, user?.roleId],
  );

  const showEmployeeDashboard = !isAdmin;

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [eventsExpanded, setEventsExpanded] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [loadingDesk, setLoadingDesk] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(true);
  const [loadingPendingUsers, setLoadingPendingUsers] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  const [myReservation, setMyReservation] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [userName, setUserName] = useState("");

  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [pendingUserCount, setPendingUserCount] = useState(0);

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsError, setAnnouncementsError] = useState("");
  const [announcementsExpanded, setAnnouncementsExpanded] = useState(true);
  const [monthCheckIns, setMonthCheckIns] = useState([]);

  const [currentYear] = useState(new Date().getFullYear());
  const [currentMonth] = useState(new Date().getMonth() + 1);

  const heroFadeAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  const goToPendingRequests = useCallback(() => {
    navigation.navigate("HomeTabs", {
      screen: "Approvals",
      params: { mainFilter: "Demandes" },
    });
  }, [navigation]);

  const goToPendingUsers = useCallback(() => {
    navigation.navigate("HomeTabs", {
      screen: "Approvals",
      params: { mainFilter: "Utilisateurs" },
    });
  }, [navigation]);

  const fetchUpcomingEvents = useCallback(async () => {
    setLoadingEvent(true);

    try {
      setEventsError("");
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = [];

      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);

        const response = await eventService.getEventsByDate(
          formatDateForApi(checkDate),
        );

        const events = getResponseData(response);

        if (Array.isArray(events)) {
          result.push(...events);
        }
      }

      const seen = new Set();
      const uniqueEvents = [];

      for (const event of result) {
        const id = event?.id ?? event?.Id;
        const key =
          id != null
            ? `id-${id}`
            : `${getEventTitle(event)}-${getEventStartValue(event)}`;

        if (seen.has(key)) continue;
        seen.add(key);
        uniqueEvents.push(event);
      }

      const upcoming = sortEventsNearestFirst(filterUpcomingEvents(uniqueEvents));

      if (__DEV__) {
        console.log("DASHBOARD EVENTS SUMMARY:", {
          rawCount: result.length,
          normalizedCount: uniqueEvents.length,
          upcomingCount: upcoming.length,
        });
      }

      setUpcomingEvents(upcoming);
    } catch (error) {
      console.log("Upcoming events error", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
      });
      setEventsError("Impossible de charger les événements.");
      setUpcomingEvents([]);
    } finally {
      setLoadingEvent(false);
    }
  }, []);

  const fetchPendingRequests = useCallback(async () => {
    if (!canReviewLeave) {
      setPendingRequestCount(0);
      setLoadingPendingRequests(false);
      return;
    }

    setLoadingPendingRequests(true);

    try {
      const [leaveRes, generalRes] = await Promise.allSettled([
        leaveService.getPendingReviewRequests(),
        requestService.getAllGeneralRequests({ status: "Pending" }),
      ]);

      const pendingLeaves =
        leaveRes.status === "fulfilled" ? getResponseData(leaveRes.value) : [];
      const pendingGeneralRequests =
        generalRes.status === "fulfilled"
          ? getResponseData(generalRes.value)
          : [];

      const leaveCount = Array.isArray(pendingLeaves)
        ? pendingLeaves.length
        : 0;
      const generalRequestCount = Array.isArray(pendingGeneralRequests)
        ? pendingGeneralRequests.length
        : 0;

      console.log("PENDING REQUESTS DASHBOARD:", {
        leaves: leaveCount,
        generalRequests: generalRequestCount,
      });

      setPendingRequestCount(leaveCount + generalRequestCount);
    } catch (error) {
      console.log("Pending request approvals error", error);
      setPendingRequestCount(0);
    } finally {
      setLoadingPendingRequests(false);
    }
  }, [canReviewLeave]);

  const fetchPendingUserApprovals = useCallback(async () => {
    if (!isAdmin) {
      setPendingUserCount(0);
      setLoadingPendingUsers(false);
      return;
    }

    setLoadingPendingUsers(true);

    try {
      const res = await adminUserService.getPendingUsers();

      console.log("PENDING USERS DASHBOARD:", res.data);

      setPendingUserCount(Array.isArray(res.data) ? res.data.length : 0);
    } catch (error) {
      console.log("Pending user approvals error", error);
      setPendingUserCount(0);
    } finally {
      setLoadingPendingUsers(false);
    }
  }, [isAdmin]);

  const fetchLeaveBalance = useCallback(async () => {
    setLoadingBalance(true);

    try {
      const response = await profileService.getProfile();
      const payload = getResponseData(response);

      setLeaveBalance(getLeaveBalanceValue(payload));
      setUserName(getDisplayName(payload));
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
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    setLoadingAnnouncements(true);

    try {
      setAnnouncementsError("");
      const res = await api.get("/Announcement");
      const data = getResponseData(res);
      setAnnouncements(
        Array.isArray(data) ? sortAnnouncementsNewestFirst(data) : [],
      );
    } catch (error) {
      console.log("Announcements error", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
      });
      setAnnouncementsError("Impossible de charger les annonces.");
      setAnnouncements([]);
    } finally {
      setLoadingAnnouncements(false);
    }
  }, []);

  const fetchMyReservation = useCallback(async () => {
    setLoadingDesk(true);

    try {
      const response = await seatService.getMyTodayReservation();
      const reservation = getResponseData(response);
      setMyReservation(reservation || null);
    } catch (error) {
      console.log("Dashboard reservation error", error);
      setMyReservation(null);
    } finally {
      setLoadingDesk(false);
    }
  }, []);

  const fetchMonthCheckIns = useCallback(async () => {
    setLoadingAttendance(true);

    try {
      const res = await seatService.getMyMonthReservations(
        currentYear,
        currentMonth,
      );

      const data = getResponseData(res);
      setMonthCheckIns(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log("Attendance summary error", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
      });
      setMonthCheckIns([]);
    } finally {
      setLoadingAttendance(false);
    }
  }, [currentYear, currentMonth]);

  const loadDashboardData = useCallback(async () => {
    const adminCalls = [
      fetchPendingRequests(),
      fetchPendingUserApprovals(),
    ];

    const employeeCalls = [fetchUpcomingEvents(), fetchAnnouncements()];

    if (!isAdmin) {
      employeeCalls.push(
        fetchMyReservation(),
        fetchLeaveBalance(),
        fetchMonthCheckIns(),
      );
    }

    await Promise.all([...adminCalls, ...employeeCalls]);
  }, [
    showEmployeeDashboard,
    fetchMyReservation,
    fetchLeaveBalance,
    fetchUpcomingEvents,
    fetchPendingRequests,
    fetchPendingUserApprovals,
    fetchAnnouncements,
    fetchMonthCheckIns,
  ]);

  useEffect(() => {
    loadDashboardData();
  }, [refreshFlag, loadDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboardData]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData]),
  );

  useEffect(() => {
    Animated.stagger(130, [
      Animated.timing(heroFadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroFadeAnim, contentFadeAnim]);

  const attendanceSummary = useMemo(
    () => buildAttendanceSummary(monthCheckIns, currentYear, currentMonth),
    [monthCheckIns, currentYear, currentMonth],
  );

  const seatLabel =
    myReservation?.seatLabel ?? myReservation?.SeatLabel ?? null;

  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const { greeting, emoji } = getGreeting();

  const displayName =
    userName ||
    user?.fullName ||
    user?.FullName ||
    user?.name ||
    user?.Name ||
    "";

  const deskChipText = loadingDesk
    ? "Vérification…"
    : seatLabel
      ? `Bureau ${seatLabel}`
      : "Aucune réservation";

  const deskChipColor = loadingDesk
    ? colors.textOnPrimary
    : seatLabel
      ? "#4ade80"
      : "#fb923c";

  const attendanceChipText = loadingAttendance
    ? "Chargement…"
    : attendanceSummary.checkedInToday
      ? "Check-in effectué"
      : "Pas encore pointé";

  const attendanceChipColor = loadingAttendance
    ? colors.textOnPrimary
    : attendanceSummary.checkedInToday
      ? "#4ade80"
      : "#fb923c";

  const balanceKnown = leaveBalance !== null;
  const balanceNum = balanceKnown ? Number(leaveBalance) : NaN;

  const noLeaveDaysLeft =
    !loadingBalance &&
    balanceKnown &&
    !Number.isNaN(balanceNum) &&
    balanceNum <= 0;

  const balanceLoadFailed = !loadingBalance && leaveBalance === null;

  const sortedAnnouncements = useMemo(
    () => sortAnnouncementsNewestFirst(announcements),
    [announcements],
  );

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
                outputRange: [18, 0],
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
              <Text style={styles.heroEyebrow}>
                {isAdmin ? "Tableau de bord administrateur" : "Tableau de bord"}
              </Text>

              <Text style={styles.heroTitle}>
                {greeting}
                {displayName ? ` ${displayName.split(" ")[0]}` : ""} {emoji}
              </Text>

              <Text style={styles.heroDate}>
                {isAdmin
                  ? "Gérez les utilisateurs, validations et ressources"
                  : todayLabel}
              </Text>
            </View>

            <View style={styles.heroIconBadge}>
              <Ionicons
                name={isAdmin ? "shield-checkmark-outline" : "sparkles-outline"}
                size={18}
                color={colors.textOnPrimary}
              />
            </View>
          </View>

          {showEmployeeDashboard && (
            <>
              <View style={styles.heroChipRow}>
                <StatusChip
                  text={deskChipText}
                  dotColor={deskChipColor}
                  styles={styles}
                />
                <StatusChip
                  text={attendanceChipText}
                  dotColor={attendanceChipColor}
                  styles={styles}
                />
              </View>

              <View style={styles.attendanceCard}>
                <View style={styles.attendanceHeaderRow}>
                  <View style={styles.attendanceTitleRow}>
                    <Ionicons
                      name="checkmark-done-circle-outline"
                      size={15}
                      color={colors.textOnPrimary}
                    />
                    <Text style={styles.attendanceCardTitle}>
                      Présence du mois
                    </Text>
                  </View>

                  {loadingAttendance ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.textOnPrimary}
                    />
                  ) : (
                    <Text style={styles.attendanceMeta}>
                      {attendanceSummary.checkedInCount}✓ ·{" "}
                      {attendanceSummary.missedCount}✗
                    </Text>
                  )}
                </View>

                {!loadingAttendance && (
                  <>
                    <View style={styles.attDayRow}>
                      {attendanceSummary.recentDays.map((item) => {
                        const backgroundColor =
                          item.type === "checked"
                            ? "rgba(74,222,128,0.18)"
                            : item.type === "missed"
                              ? "rgba(251,146,60,0.22)"
                              : item.type === "today"
                                ? "rgba(255,255,255,0.18)"
                                : "rgba(255,255,255,0.06)";

                        const borderColor =
                          item.type === "checked"
                            ? "rgba(74,222,128,0.45)"
                            : item.type === "missed"
                              ? "rgba(251,146,60,0.55)"
                              : item.type === "today"
                                ? "rgba(255,255,255,0.38)"
                                : "rgba(255,255,255,0.08)";

                        return (
                          <View
                            key={item.key}
                            style={[
                              styles.attDay,
                              { backgroundColor, borderColor },
                              item.type === "today" && styles.attDayToday,
                            ]}
                          >
                            {item.type === "checked" ? (
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color="#4ade80"
                              />
                            ) : item.type === "missed" ? (
                              <Ionicons
                                name="close"
                                size={14}
                                color="#fb923c"
                              />
                            ) : (
                              <Text
                                style={[
                                  styles.attDayLabel,
                                  item.type === "empty" && { opacity: 0 },
                                ]}
                              >
                                {item.label}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    <Text style={styles.attLegend}>
                      Vert = validé · orange = manqué · blanc = aujourd&apos;hui
                    </Text>
                  </>
                )}
              </View>
            </>
          )}
        </LinearGradient>
      </Animated.View>

      <Animated.View
        style={{
          opacity: contentFadeAnim,
          transform: [
            {
              translateY: contentFadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        }}
      >
        {showEmployeeDashboard && (
          <>
            <SectionHeader title="Centre des demandes" styles={styles} />

            <Card style={styles.card}>
              <CardHeader
                icon="albums-outline"
                title="Demandes"
                styles={styles}
                colors={colors}
              />

              {loadingBalance ? (
                <View style={styles.inlineLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loaderText}>Chargement du solde…</Text>
                </View>
              ) : balanceLoadFailed ? (
                <Text style={styles.cardBody}>
                  Impossible de charger votre solde. Faites glisser pour
                  actualiser.
                </Text>
              ) : (
                <>
                  <Text style={styles.cardEmptyTitle}>Solde de congés</Text>
                  <Text style={styles.balanceBigNum}>
                    {balanceNum}
                    <Text style={styles.balanceUnit}>
                      {" "}
                      {balanceNum === 1 ? "jour" : "jours"}
                    </Text>
                  </Text>

                  {noLeaveDaysLeft && (
                    <Text style={styles.balanceWarning}>
                      Vous n&apos;avez plus de jours de congé disponibles.
                      Les autres types de demandes restent accessibles.
                    </Text>
                  )}

                  <Text style={styles.cardBody}>
                    Accédez au centre des demandes pour créer une demande de
                    congé, de récupération, de télétravail, de document ou
                    d&apos;autorisation.
                  </Text>

                  <Button
                    title="Accéder aux demandes"
                    variant="primary"
                    onPress={() => navigation.navigate("DemandMenu")}
                    style={styles.cardBtn}
                  />
                </>
              )}
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
                Consultez les disponibilités et réservez un bureau pour votre
                journée de travail en présentiel.
              </Text>
              <Button
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
                  Consultez les disponibilités et soumettez une demande de
                  réservation de salle.
                </Text>
                <Button
                  title="Réserver une salle"
                  variant="primary"
                  onPress={() => navigation.navigate("Rooms")}
                  style={styles.cardBtn}
                />
              </Card>
            )}

            <Card style={styles.card}>
              <Pressable
                style={styles.announcementSectionHeader}
                onPress={() =>
                  setAnnouncementsExpanded((isExpanded) => !isExpanded)
                }
                accessibilityRole="button"
              >
                <View style={styles.announcementHeaderTitleWrap}>
                  <View
                    style={[
                      styles.cardHeaderIconWrap,
                      {
                        backgroundColor:
                          colors.primaryLight ?? `${colors.primary}18`,
                      },
                    ]}
                  >
                    <Ionicons
                      name="megaphone-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </View>

                  <Text style={styles.announcementSectionTitle}>
                    Annonces ({sortedAnnouncements.length})
                  </Text>
                </View>

                <Ionicons
                  name={
                    announcementsExpanded ? "chevron-up" : "chevron-down"
                  }
                  size={22}
                  color={colors.textSecondary}
                />
              </Pressable>

              {announcementsExpanded ? (
                loadingAnnouncements ? (
                  <View style={styles.inlineLoader}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loaderText}>
                      Chargement des annonces…
                    </Text>
                  </View>
                ) : announcementsError ? (
                  <Text style={styles.cardBody}>{announcementsError}</Text>
                ) : sortedAnnouncements.length > 0 ? (
                  <View style={styles.announcementList}>
                    {sortedAnnouncements.map((announcement, index) => {
                      const imageUrl = getAnnouncementImage(announcement);
                      const dateLabel = formatAnnouncementDate(announcement);
                      const content = getAnnouncementContent(announcement);
                      const important = isAnnouncementImportant(announcement);

                      return (
                        <View
                          key={getAnnouncementId(announcement, index)}
                          style={styles.announcementItem}
                        >
                          {imageUrl ? (
                            <Image
                              source={{ uri: imageUrl }}
                              style={styles.announcementImage}
                            />
                          ) : null}

                          <View style={styles.announcementMetaRow}>
                            {important ? (
                              <View style={styles.announcementBadge}>
                                <Text style={styles.announcementBadgeText}>
                                  Important
                                </Text>
                              </View>
                            ) : null}

                            {dateLabel ? (
                              <Text style={styles.announcementDate}>
                                {dateLabel}
                              </Text>
                            ) : null}
                          </View>

                          <Text
                            style={styles.announcementTitle}
                            numberOfLines={2}
                          >
                            {getAnnouncementTitle(announcement)}
                          </Text>

                          {content ? (
                            <Text
                              style={styles.announcementBody}
                              numberOfLines={3}
                            >
                              {truncateAnnouncement(content, 140)}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.cardBody}>
                    Aucune annonce disponible pour le moment.
                  </Text>
                )
              ) : null}
            </Card>
          </>
        )}

        {isAdmin && (
          <>
            <SectionHeader title="Vue rapide" styles={styles} />

            <View style={styles.adminRow}>
              <AdminStatChip
                label="Demandes en attente"
                count={pendingRequestCount}
                loading={loadingPendingRequests}
                badgeText="À valider"
                onPress={goToPendingRequests}
                styles={styles}
                colors={colors}
              />

              <AdminStatChip
                label="Comptes en attente"
                count={pendingUserCount}
                loading={loadingPendingUsers}
                badgeText="À approuver"
                onPress={goToPendingUsers}
                styles={styles}
                colors={colors}
              />
            </View>

            <SectionHeader title="Administration" styles={styles} />

            <AdminActionCard
              icon="people-outline"
              title="Gestion des utilisateurs"
              description="Consultez les utilisateurs, modifiez leurs informations, attribuez des rôles ou supprimez des comptes."
              buttonTitle="Gérer les utilisateurs"
              onPress={() => navigation.navigate("UserManagement")}
              styles={styles}
              colors={colors}
            />

            <SectionHeader title="Ressources" styles={styles} />

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
        )}

        {!isAdmin && canReviewLeave && (
          <>
            <SectionHeader title="Administration" styles={styles} />

            <View style={styles.adminRow}>
              <AdminStatChip
                label="Demandes en attente"
                count={pendingRequestCount}
                loading={loadingPendingRequests}
                badgeText="À valider"
                onPress={goToPendingRequests}
                styles={styles}
                colors={colors}
              />
            </View>
          </>
        )}

        <Card style={styles.card}>
          <Pressable
            style={styles.eventSectionHeader}
            onPress={() => setEventsExpanded((isExpanded) => !isExpanded)}
            accessibilityRole="button"
          >
            <View style={styles.eventHeaderTitleWrap}>
              <View
                style={[
                  styles.cardHeaderIconWrap,
                  {
                    backgroundColor:
                      colors.primaryLight ?? `${colors.primary}18`,
                  },
                ]}
              >
                <Ionicons
                  name="calendar-clear-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.eventSectionTitle}>
                Prochains événements ({upcomingEvents.length})
              </Text>
            </View>

            <Ionicons
              name={eventsExpanded ? "chevron-up" : "chevron-down"}
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>

          {eventsExpanded ? (
            loadingEvent ? (
              <View style={styles.inlineLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loaderText}>Chargement du calendrier…</Text>
              </View>
            ) : eventsError ? (
              <Text style={styles.cardBody}>{eventsError}</Text>
            ) : upcomingEvents?.length > 0 ? (
              <View style={styles.eventList}>
                {upcomingEvents.map((event, index) => {
                  const imageUrl = getEventImage(event);
                  const location = getEventLocation(event);
                  const description = getEventDescription(event);
                  const important = isEventImportant(event);

                  return (
                    <View
                      key={getEventId(event, index)}
                      style={styles.eventItem}
                    >
                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.eventImage} />
                      ) : null}

                      <View style={styles.eventMetaRow}>
                        {important ? (
                          <View style={styles.eventBadge}>
                            <Text style={styles.eventBadgeText}>Important</Text>
                          </View>
                        ) : null}

                        <Text style={styles.eventDateText}>
                          {formatEventDateTime(event)}
                        </Text>
                      </View>

                      <Text style={styles.eventTitle} numberOfLines={2}>
                        {getEventTitle(event)}
                      </Text>

                      {location ? (
                        <View style={styles.eventLocationRow}>
                          <Ionicons
                            name="location-outline"
                            size={14}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.eventLocationText} numberOfLines={1}>
                            {location}
                          </Text>
                        </View>
                      ) : null}

                      {description ? (
                        <Text style={styles.eventDescription} numberOfLines={3}>
                          {truncateAnnouncement(description, 136)}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <>
                <Text style={styles.cardEmptyTitle}>Aucun événement prévu</Text>
                <Text style={styles.cardBody}>
                  Rien dans les 30 prochains jours.
                </Text>
              </>
            )
          ) : null}
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
      paddingBottom: spacing.xxl + 90,
    },

    hero: {
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      marginBottom: spacing.xl,
      ...shadows.sm,
    },

    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.md,
      marginBottom: spacing.md,
    },

    heroTextWrap: {
      flex: 1,
    },

    heroEyebrow: {
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.textOnPrimary,
      opacity: 0.78,
      marginBottom: 4,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },

    heroTitle: {
      fontSize: typography.xxl,
      fontFamily: typography.fontFamily?.bold,
      color: colors.textOnPrimary,
      lineHeight: typography.xxl * 1.2,
    },

    heroDate: {
      marginTop: 4,
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textOnPrimary,
      opacity: 0.78,
    },

    heroIconBadge: {
      width: 38,
      height: 38,
      borderRadius: borderRadius.full,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },

    heroChipRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    heroChip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: borderRadius.md,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },

    heroChipDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },

    heroChipText: {
      flex: 1,
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.medium,
      color: colors.textOnPrimary,
      opacity: 0.92,
    },

    attendanceCard: {
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },

    attendanceHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },

    attendanceTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    attendanceCardTitle: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.textOnPrimary,
    },

    attendanceMeta: {
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.medium,
      color: colors.textOnPrimary,
      opacity: 0.84,
    },

    attDayRow: {
      flexDirection: "row",
      gap: 5,
    },

    attDay: {
      flex: 1,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    attDayToday: {
      transform: [{ scale: 1.05 }],
    },

    attDayLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textOnPrimary,
    },

    attLegend: {
      marginTop: 8,
      fontSize: 10,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textOnPrimary,
      opacity: 0.68,
    },

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

    inlineLoader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },

    loaderText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
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

    successPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.successLight,
      paddingVertical: 7,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      alignSelf: "flex-start",
      marginBottom: spacing.xs,
    },

    successPillText: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.success,
    },

    balanceBigNum: {
      fontSize: 38,
      fontFamily: typography.fontFamily?.bold,
      color: colors.primary,
      lineHeight: 44,
      marginVertical: spacing.xs,
    },

    balanceUnit: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
    },

    balanceWarning: {
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.medium,
      color: colors.warning,
      marginBottom: spacing.xs,
    },

    eventSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },

    eventHeaderTitleWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    eventSectionTitle: {
      flex: 1,
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
    },

    eventList: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },

    eventItem: {
      borderWidth: 1,
      borderColor: colors.border ?? `${colors.text}14`,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceMuted ?? colors.background,
      padding: spacing.md,
      ...shadows.sm,
    },

    eventImage: {
      width: "100%",
      aspectRatio: 16 / 9,
      borderRadius: borderRadius.md,
      backgroundColor: colors.border,
      marginBottom: spacing.md,
    },

    eventMetaRow: {
      minHeight: 22,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },

    eventBadge: {
      borderRadius: borderRadius.full,
      backgroundColor: colors.warningLight ?? "#fef3c7",
      paddingHorizontal: 9,
      paddingVertical: 3,
    },

    eventBadgeText: {
      fontSize: 10,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.warning ?? "#92400e",
      textTransform: "uppercase",
    },

    eventDateText: {
      flexShrink: 1,
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.medium,
      color: colors.textSecondary,
    },

    eventLocationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 2,
      marginBottom: spacing.xs,
    },

    eventLocationText: {
      flex: 1,
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.medium,
      color: colors.textSecondary,
    },

    eventDescription: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
      lineHeight: 19,
    },

    eventTitle: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      marginBottom: 3,
    },

    divider: {
      height: 1,
      backgroundColor: colors.border ?? `${colors.text}12`,
      marginVertical: spacing.md,
    },

    announcementSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },

    announcementHeaderTitleWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    announcementSectionTitle: {
      flex: 1,
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
    },

    announcementList: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },

    announcementItem: {
      borderWidth: 1,
      borderColor: colors.border ?? `${colors.text}14`,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceMuted ?? colors.background,
      padding: spacing.md,
      ...shadows.sm,
    },

    announcementImage: {
      width: "100%",
      aspectRatio: 16 / 9,
      borderRadius: borderRadius.md,
      backgroundColor: colors.border,
      marginBottom: spacing.md,
    },

    announcementMetaRow: {
      minHeight: 22,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },

    announcementBadge: {
      borderRadius: borderRadius.full,
      backgroundColor: colors.warningLight ?? "#fef3c7",
      paddingHorizontal: 9,
      paddingVertical: 3,
    },

    announcementBadgeText: {
      fontSize: 10,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.warning ?? "#92400e",
      textTransform: "uppercase",
    },

    announcementDate: {
      flexShrink: 1,
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.medium,
      color: colors.textSecondary,
    },

    announcementTitle: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      marginBottom: 4,
    },

    announcementBody: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
      lineHeight: 19,
    },

    adminRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.xl,
    },

    adminChip: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      ...shadows.sm,
    },

    adminChipNum: {
      fontSize: 28,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
      lineHeight: 34,
    },

    adminChipLabel: {
      marginTop: 2,
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
    },

    adminChipBadge: {
      marginTop: 6,
      alignSelf: "flex-start",
      backgroundColor: colors.warningLight ?? "#fef9c3",
      borderRadius: borderRadius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },

    adminChipBadgeText: {
      fontSize: 10,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.warning ?? "#92400e",
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

export default DashboardScreen;
