import logger from "../utils/logger";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { eventService } from "../services/api";
import { EmptyState } from "../components";
import { useTheme } from "../context/ThemeContext";

const EVENT_TYPE_LABEL_FR = {
  1: "Réunion",
  2: "Formation",
  3: "Atelier",
  4: "Conférence",
  5: "Social",
  6: "Annonce",
  7: "Autre",
};

const TUNISIA_TIME_ZONE = "Africa/Tunis";

const getTunisiaParts = (date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TUNISIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
};

const parseApiInstant = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const hasOffset = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
    return new Date(hasOffset ? value : `${value}Z`);
  }
  return new Date(value);
};

const formatTunisiaDateKey = (date) => {
  const parts = getTunisiaParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
};

const addDaysToDateKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(year, month - 1, day);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(value.getDate()).padStart(2, "0")}`;
};

const normalizeEvent = (item) => {
  const id = item?.id ?? item?.Id;
  const title = item?.title ?? item?.Title ?? "Événement";
  const description = item?.description ?? item?.Description ?? "";
  const type = item?.type ?? item?.Type ?? null;
  const roomName = item?.roomName ?? item?.RoomName ?? null;

  const start =
    item?.startDateTime ??
    item?.StartDateTime ??
    item?.date ??
    item?.Date ??
    null;
  const end = item?.endDateTime ?? item?.EndDateTime ?? null;

  return {
    id,
    title,
    description,
    type,
    roomName,
    startDateTime: start,
    endDateTime: end,
  };
};

const EventsScreen = () => {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
  );

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const todayKey = formatTunisiaDateKey(new Date());

      const daysToLoad = 30;
      const results = [];

      for (let i = 0; i < daysToLoad; i++) {
        const dateStr = addDaysToDateKey(todayKey, i);
        const res = await eventService.getEventsByDate(dateStr);
        const list = res?.data || [];
        if (Array.isArray(list) && list.length > 0) results.push(...list);
      }

      const normalized = results
        .map(normalizeEvent)
        .filter((e) => e.id != null)
        .sort(
          (a, b) =>
            parseApiInstant(a.startDateTime).getTime() -
            parseApiInstant(b.startDateTime).getTime(),
        );

      const uniq = [];
      const seen = new Set();
      for (const e of normalized) {
        const key = String(e.id);
        if (seen.has(key)) continue;
        seen.add(key);
        uniq.push(e);
      }

      setEvents(uniq);
    } catch (err) {
      logger.debug("LOAD EVENTS ERROR:", err?.response?.data || err.message);
      setEvents([]);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents(true);
  }, [loadEvents]);

  useFocusEffect(
    useCallback(() => {
      loadEvents(false);
    }, [loadEvents]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEvents(false);
    } finally {
      setRefreshing(false);
    }
  };

  const formatEventDate = (dateValue) => {
    const date = parseApiInstant(dateValue);

    return date.toLocaleDateString("fr-FR", {
      timeZone: TUNISIA_TIME_ZONE,
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatEventTime = (dateValue) => {
    const date = parseApiInstant(dateValue);

    return date.toLocaleTimeString("fr-FR", {
      timeZone: TUNISIA_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderEventCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeDay}>
            {String(getTunisiaParts(parseApiInstant(item.startDateTime)).day)}
          </Text>
          <Text style={styles.dateBadgeMonth}>
            {parseApiInstant(item.startDateTime).toLocaleDateString("fr-FR", {
              timeZone: TUNISIA_TIME_ZONE,
              month: "short",
            })}
          </Text>
        </View>

        <View style={styles.cardMain}>
          <Text style={styles.title}>{item.title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {formatEventDate(item.startDateTime)}
            </Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>
              {formatEventTime(item.startDateTime)}
              {item.endDateTime
                ? ` – ${formatEventTime(item.endDateTime)}`
                : ""}
            </Text>
          </View>

          {(item.roomName || item.type) && (
            <Text style={styles.metaExtra}>
              {item.roomName ? item.roomName : null}
              {item.roomName && item.type ? " • " : null}
              {item.type
                ? (EVENT_TYPE_LABEL_FR[item.type] ?? "Événement")
                : null}
            </Text>
          )}
        </View>
      </View>

      {!!item.description && (
        <Text style={styles.description}>{item.description}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          Chargement des événements à venir...
        </Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.screenTitle}>Événements à venir</Text>
              <Text style={styles.screenSubtitle}>
                Restez informé des prochains événements
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.emptyWrapper}>
          <EmptyState
            iconName="calendar-outline"
            title="Aucun événement"
            subtitle="Il n’y a aucun événement à venir."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Événements à venir</Text>
            <Text style={styles.screenSubtitle}>
              Restez informé des prochains événements
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEventCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
};

const createStyles = (colors, spacing, borderRadius, typography, shadows) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    header: {
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },

    screenTitle: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: colors.text,
    },

    screenSubtitle: {
      marginTop: spacing.xs,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    addButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      ...shadows.sm,
    },
    addButtonText: {
      color: colors.textOnPrimary,
      fontSize: typography.sm,
      fontWeight: typography.bold,
    },

    listContent: {
      padding: spacing.lg,
      paddingBottom: 120,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },

    cardTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },

    dateBadge: {
      width: 58,
      minHeight: 64,
      borderRadius: borderRadius.md,
      backgroundColor: colors.errorLight,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
      paddingVertical: spacing.sm,
    },

    dateBadgeDay: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.primary,
      lineHeight: 22,
    },

    dateBadgeMonth: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.primary,
      textTransform: "uppercase",
      marginTop: 2,
    },

    cardMain: {
      flex: 1,
    },

    title: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
    },

    metaText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    metaDot: {
      marginHorizontal: spacing.sm,
      color: colors.textMuted,
    },
    metaExtra: {
      marginTop: 6,
      fontSize: typography.xs,
      color: colors.textSecondary,
      fontWeight: typography.semibold,
    },

    description: {
      marginTop: spacing.md,
      fontSize: typography.sm,
      color: colors.text,
      lineHeight: 20,
    },

    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      padding: spacing.xl,
    },

    loadingText: {
      marginTop: spacing.md,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    emptyWrapper: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });
export default EventsScreen;
