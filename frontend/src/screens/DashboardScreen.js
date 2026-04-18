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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { seatService, profileService, eventService } from "../services/api";
import api from "../services/api/axiosInstance";
import { Card, Button } from "../components";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

/* ----------------------------- Helper functions ---------------------------- */

const getResponseData = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return response?.data?.data ?? response?.data ?? null;
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
    isHr: normalized === "hr" || normalized === 4,
    isManager: normalized === "manager" || normalized === 2,
    canReviewLeave:
      normalized === "admin" ||
      normalized === "hr" ||
      normalized === 3 ||
      normalized === 4,
  };
};

const formatDateForApi = (date) => date.toISOString().split("T")[0];

const formatEventCompact = (event) => {
  const raw =
    event?.date ?? event?.Date ?? event?.startDateTime ?? event?.StartDateTime;

  if (!raw) return "Date à confirmer";

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);

  const datePart = d.toLocaleDateString("fr-FR", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const timePart = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${datePart} · ${timePart}`;
};

const getEventDateParts = (event) => {
  const raw =
    event?.date ?? event?.Date ?? event?.startDateTime ?? event?.StartDateTime;

  if (!raw) {
    return { day: "—", month: "—" };
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return { day: "—", month: "—" };
  }

  return {
    day: String(d.getDate()),
    month: d
      .toLocaleDateString("fr-FR", { month: "short" })
      .replace(".", "")
      .toUpperCase(),
  };
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

    const isSameMonth =
      d.getFullYear() === year && d.getMonth() === monthIndex;

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

  if (hour < 12) {
    return { greeting: "Bonjour", emoji: "🌅" };
  }

  if (hour < 18) {
    return { greeting: "Bon après-midi", emoji: "👋" };
  }

  return { greeting: "Bonsoir", emoji: "🌙" };
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

/* ------------------------------ Main screen ------------------------------- */

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const { user } = useAuth();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const { isAdmin, isHr, isManager, canReviewLeave } = useMemo(
    () => getRoleFlags(user?.role),
    [user?.role],
  );

  const canManageRooms = isManager || isHr;

  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [loadingDesk, setLoadingDesk] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingPendingLeave, setLoadingPendingLeave] = useState(true);
  const [loadingPendingUsers, setLoadingPendingUsers] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  const [myReservation, setMyReservation] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [userName, setUserName] = useState("");

  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [pendingUserCount, setPendingUserCount] = useState(0);

  const [announcements, setAnnouncements] = useState([]);
  const [monthCheckIns, setMonthCheckIns] = useState([]);

  const [currentYear] = useState(new Date().getFullYear());
  const [currentMonth] = useState(new Date().getMonth() + 1);

  const heroFadeAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  const fetchUpcomingEvent = useCallback(async () => {
    setLoadingEvent(true);

    try {
      const today = new Date();
      let foundEvent = null;

      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);

        const response = await eventService.getEventsByDate(
          formatDateForApi(checkDate),
        );

        const events = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : [];

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
  }, []);

  const fetchPendingLeaveApprovals = useCallback(async () => {
    if (!canReviewLeave) {
      setPendingLeaveCount(0);
      setLoadingPendingLeave(false);
      return;
    }

    setLoadingPendingLeave(true);

    try {
      const res = await api.get("/Leave/pending-review");
      const data = getResponseData(res);
      setPendingLeaveCount(Array.isArray(data) ? data.length : 0);
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
  }, [canReviewLeave]);

  const fetchPendingUserApprovals = useCallback(async () => {
    if (!isAdmin) {
      setPendingUserCount(0);
      setLoadingPendingUsers(false);
      return;
    }

    setLoadingPendingUsers(true);

    try {
      const res = await api.get("/admin/users/pending");
      const data = getResponseData(res);
      setPendingUserCount(Array.isArray(data) ? data.length : 0);
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
      const res = await api.get("/Announcement");
      const data = getResponseData(res);
      setAnnouncements(Array.isArray(data) ? data : []);
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
    await Promise.all([
      fetchMyReservation(),
      fetchLeaveBalance(),
      fetchUpcomingEvent(),
      fetchPendingLeaveApprovals(),
      fetchPendingUserApprovals(),
      fetchAnnouncements(),
      fetchMonthCheckIns(),
    ]);
  }, [
    fetchMyReservation,
    fetchLeaveBalance,
    fetchUpcomingEvent,
    fetchPendingLeaveApprovals,
    fetchPendingUserApprovals,
    fetchAnnouncements,
    fetchMonthCheckIns,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboardData]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

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

  const seatLabel = myReservation?.seatLabel ?? myReservation?.SeatLabel ?? null;

  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const { greeting, emoji } = getGreeting();

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

  const firstAnnouncement = announcements[0];
  const announcementTitle = firstAnnouncement?.title ?? firstAnnouncement?.Title;
  const announcementContent =
    firstAnnouncement?.content ?? firstAnnouncement?.Content ?? "";

  const { day: eventDay, month: eventMonth } = getEventDateParts(upcomingEvent);

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
              <Text style={styles.heroEyebrow}>Tableau de bord</Text>
              <Text style={styles.heroTitle}>
                {greeting}
                {userName ? ` ${userName.split(" ")[0]}` : ""} {emoji}
              </Text>
              <Text style={styles.heroDate}>{todayLabel}</Text>
            </View>

            <View style={styles.heroIconBadge}>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={colors.textOnPrimary}
              />
            </View>
          </View>

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
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
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
                          <Ionicons name="close" size={14} color="#fb923c" />
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
        <SectionHeader title="Espace de travail" styles={styles} />

        <Card style={styles.card}>
          <CardHeader
            icon="desktop-outline"
            title="Votre bureau aujourd'hui"
            styles={styles}
            colors={colors}
          />

          {loadingDesk ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loaderText}>
                Chargement de la réservation…
              </Text>
            </View>
          ) : seatLabel ? (
            <>
              <View style={styles.successPill}>
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={colors.success}
                />
                <Text style={styles.successPillText}>
                  Poste {seatLabel} réservé pour aujourd&apos;hui
                </Text>
              </View>

              <Text style={styles.cardBody}>
                Ouvrez le plan des bureaux pour voir votre emplacement.
              </Text>

              <Button
                title="Ouvrir le plan des bureaux"
                variant="secondary"
                onPress={() => navigation.navigate("Desk")}
                style={styles.cardBtn}
              />
            </>
          ) : (
            <>
              <Text style={styles.cardEmptyTitle}>Aucune réservation</Text>
              <Text style={styles.cardBody}>
                Choisissez un poste si vous prévoyez de venir au bureau
                aujourd&apos;hui.
              </Text>

              <Button
                title="Réserver un bureau"
                onPress={() => navigation.navigate("Desk")}
                style={styles.cardBtn}
              />
            </>
          )}
        </Card>

        <SectionHeader title="Solde de congés" styles={styles} />

        <Card style={styles.card}>
          <CardHeader
            icon="wallet-outline"
            title="Jours disponibles"
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
              Impossible de charger votre solde. Faites glisser pour actualiser.
            </Text>
          ) : (
            <>
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
                </Text>
              )}

              <Text style={styles.cardBody}>
                {balanceNum > 0
                  ? "Vous pouvez soumettre une nouvelle demande de congé."
                  : "Consultez vos demandes précédentes ci-dessous."}
              </Text>

              <Button
                title={
                  balanceNum > 0
                    ? "Créer une demande de congé"
                    : "Voir les demandes précédentes"
                }
                variant={balanceNum > 0 ? "primary" : "secondary"}
                onPress={() =>
                  navigation.navigate("LeaveRequest", {
                    openCreateModal: balanceNum > 0,
                  })
                }
                style={styles.cardBtn}
              />
            </>
          )}
        </Card>

        <SectionHeader title="Prochain événement" styles={styles} />

        <Card style={styles.card}>
          <CardHeader
            icon="calendar-clear-outline"
            title="Agenda"
            styles={styles}
            colors={colors}
          />

          {loadingEvent ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loaderText}>Chargement du calendrier…</Text>
            </View>
          ) : upcomingEvent ? (
            <View style={styles.eventRow}>
              <View style={styles.eventDateBadge}>
                <Text style={styles.eventDateDay}>{eventDay}</Text>
                <Text style={styles.eventDateMon}>{eventMonth}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={2}>
                  {upcomingEvent?.title ??
                    upcomingEvent?.Title ??
                    "Événement sans titre"}
                </Text>
                <Text style={styles.eventTime}>
                  {formatEventCompact(upcomingEvent)}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.cardEmptyTitle}>Aucun événement prévu</Text>
              <Text style={styles.cardBody}>Rien dans les 7 prochains jours.</Text>
            </>
          )}

          <View style={styles.divider} />

          <Button
            title="Voir les événements"
            variant={upcomingEvent ? "secondary" : "primary"}
            onPress={() => navigation.navigate("Events")}
            style={styles.cardBtn}
          />
        </Card>

        {canManageRooms && (
          <Card style={styles.card}>
            <CardHeader
              icon="library-outline"
              title="Réserver une salle"
              styles={styles}
              colors={colors}
            />
            <Text style={styles.cardEmptyTitle}>Gérez les salles</Text>
            <Text style={styles.cardBody}>
              Consultez les disponibilités et soumettez une demande de réservation (validation requise).
            </Text>
            <Button
              title="Réserver une salle"
              variant="primary"
              onPress={() => navigation.navigate("Rooms")}
              style={styles.cardBtn}
            />
          </Card>
        )}

        <SectionHeader title="Annonces" styles={styles} />

        <Card style={styles.card}>
          <CardHeader
            icon="megaphone-outline"
            title="Dernière annonce"
            styles={styles}
            colors={colors}
          />

          {loadingAnnouncements ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loaderText}>Chargement des annonces…</Text>
            </View>
          ) : announcements.length > 0 ? (
            <View style={styles.announcementStrip}>
              <Text style={styles.announcementTitle}>
                {announcementTitle ?? "Annonce"}
              </Text>
              <Text style={styles.announcementBody}>
                {announcementContent.length > 140
                  ? `${announcementContent.slice(0, 140)}…`
                  : announcementContent}
              </Text>
            </View>
          ) : (
            <Text style={styles.cardBody}>
              Aucune annonce disponible pour le moment.
            </Text>
          )}

          {(isHr || isAdmin) && (
            <Button
              title="Gérer les annonces"
              variant="primary"
              onPress={() => navigation.navigate("ManageAnnouncements")}
              style={styles.cardBtn}
            />
          )}
        </Card>

        {canReviewLeave && (
          <>
            <SectionHeader title="Administration" styles={styles} />

            <View style={styles.adminRow}>
              <AdminStatChip
                label="Congés en attente"
                count={pendingLeaveCount}
                loading={loadingPendingLeave}
                badgeText="À valider"
                onPress={() => navigation.navigate("LeaveRequest")}
                styles={styles}
                colors={colors}
              />

              {isAdmin && (
                <AdminStatChip
                  label="Comptes en attente"
                  count={pendingUserCount}
                  loading={loadingPendingUsers}
                  badgeText="À approuver"
                  onPress={() => navigation.navigate("Approvals")}
                  styles={styles}
                  colors={colors}
                />
              )}
            </View>

            {isAdmin && (
              <Card style={styles.card}>
                <CardHeader
                  icon="people-outline"
                  title="Gestion des utilisateurs"
                  styles={styles}
                  colors={colors}
                />
                <Text style={styles.cardBody}>
                  Consultez tous les utilisateurs, modifiez leurs informations, attribuez des rôles ou supprimez des comptes.
                </Text>
                <Button
                  title="Gérer les utilisateurs"
                  variant="primary"
                  onPress={() => navigation.navigate("UserManagement")}
                  style={styles.cardBtn}
                />
              </Card>
            )}
            
            {(isAdmin || isHr) && (
              <>
                <Card style={styles.card}>
                  <CardHeader
                    icon="business-outline"
                    title="Gestion des salles"
                    styles={styles}
                    colors={colors}
                  />
                  <Text style={styles.cardBody}>
                    Gérez les salles de réunion, leur capacité et leur statut.
                  </Text>
                  <Button
                    title="Gérer les salles"
                    variant="secondary"
                    onPress={() => navigation.navigate("RoomManagement")}
                    style={styles.cardBtn}
                  />
                </Card>
                
                <Card style={styles.card}>
                  <CardHeader
                    icon="desktop-outline"
                    title="Gestion des sièges et tables"
                    styles={styles}
                    colors={colors}
                  />
                  <Text style={styles.cardBody}>
                    Gérez la disposition des tables et les sièges du bureau.
                  </Text>
                  <Button
                    title="Gérer les sièges"
                    variant="secondary"
                    onPress={() => navigation.navigate("SeatManagement")}
                    style={styles.cardBtn}
                  />
                </Card>
              </>
            )}
          </>
        )}
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

    eventRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      marginBottom: spacing.xs,
    },

    eventDateBadge: {
      minWidth: 48,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: borderRadius.md,
      alignItems: "center",
      backgroundColor: colors.surfaceMuted ?? colors.background,
    },

    eventDateDay: {
      fontSize: 22,
      fontFamily: typography.fontFamily?.bold,
      color: colors.primary,
      lineHeight: 26,
    },

    eventDateMon: {
      fontSize: 9,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },

    eventTitle: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      marginBottom: 3,
    },

    eventTime: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
    },

    divider: {
      height: 1,
      backgroundColor: colors.border ?? `${colors.text}12`,
      marginVertical: spacing.md,
    },

    announcementStrip: {
      borderLeftWidth: 2,
      borderLeftColor: colors.primary,
      paddingLeft: spacing.md,
      marginVertical: spacing.sm,
    },

    announcementTitle: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      marginBottom: 3,
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
  });

export default DashboardScreen;