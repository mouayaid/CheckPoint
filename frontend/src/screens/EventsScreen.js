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
import { useAuth } from "../context/AuthContext";

const EVENT_TYPE_LABEL_FR = {
  1: "Réunion",
  2: "Formation",
  3: "Atelier",
  4: "Conférence",
  5: "Social",
  6: "Annonce",
  7: "Autre",
};

const normalizeRole = (role) => {
  if (typeof role === "string") return role.trim().toLowerCase();
  if (typeof role === "number") return role;
  return null;
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
  const { user } = useAuth();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
  );

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const role = normalizeRole(user?.role);
  const canManageEvents = role === "admin" || role === "hr" || role === 3 || role === 4;

  const formatDateForApi = (date) => date.toISOString().split("T")[0];

  const loadEvents = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      // Backend: GET /api/Events?date=YYYY-MM-DD returns events for that day only.
      // To show "upcoming", we load the next N days and merge.
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const daysToLoad = 30;
      const results = [];

      for (let i = 0; i < daysToLoad; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);

        const dateStr = formatDateForApi(d);
        // eventService already uses '/events' and correct query parameter
        const res = await eventService.getEventsByDate(dateStr);
        const list = res?.data || [];
        if (Array.isArray(list) && list.length > 0) results.push(...list);
      }

      const normalized = results
        .map(normalizeEvent)
        .filter((e) => e.id != null)
        .sort(
          (a, b) =>
            new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime(),
        );

      // de-dupe by id
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
      console.log("LOAD EVENTS ERROR:", err?.response?.data || err.message);
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
      // refresh when coming back from create screen
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
    const date = new Date(dateValue);

    return date.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatEventTime = (dateValue) => {
    const date = new Date(dateValue);

    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderEventCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeDay}>
            {new Date(item.startDateTime).getDate()}
          </Text>
          <Text style={styles.dateBadgeMonth}>
            {new Date(item.startDateTime).toLocaleDateString("fr-FR", {
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
              {item.type ? (EVENT_TYPE_LABEL_FR[item.type] ?? "Événement") : null}
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
        <Text style={styles.loadingText}>Chargement des événements à venir...</Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.emptyWrapper}>
        <EmptyState
          iconName="calendar-outline"
          title="Aucun événement"
          subtitle="Il n’y a aucun événement à venir."
        />
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

          {canManageEvents && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate("EventManagement")}
              activeOpacity={0.85}
              accessibilityLabel="Gérer les événements"
            >
              <Ionicons name="add" size={18} color={colors.textOnPrimary} />
              <Text style={styles.addButtonText}>Créer</Text>
            </TouchableOpacity>
          )}
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
      paddingBottom: spacing.xxxl,
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
