import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { axiosInstance } from "../services/api";
import { EmptyState } from "../components";
import { useTheme } from "../context/ThemeContext";

const EventsScreen = () => {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
  );

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      // Backend currently exposes EventsController for date-based queries.
      // For "upcoming" UX we can request events from "today" onwards.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const res = await axiosInstance.get("/Events", {
        params: { date: today.toISOString() },
      });
      if (res?.success) {
        setEvents(res.data || []);
      } else {
        setEvents([]);
      }
    } catch (err) {
      console.log("LOAD EVENTS ERROR:", err?.response?.data || err.message);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
  };

  const formatEventDate = (dateValue) => {
    const date = new Date(dateValue);

    return date.toLocaleDateString([], {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatEventTime = (dateValue) => {
    const date = new Date(dateValue);

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderEventCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeDay}>
            {new Date(item.date).getDate()}
          </Text>
          <Text style={styles.dateBadgeMonth}>
            {new Date(item.date).toLocaleDateString([], { month: "short" })}
          </Text>
        </View>

        <View style={styles.cardMain}>
          <Text style={styles.title}>{item.title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{formatEventDate(item.date)}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{formatEventTime(item.date)}</Text>
          </View>
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
        <Text style={styles.loadingText}>Loading upcoming events...</Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.emptyWrapper}>
        <EmptyState
          iconName="calendar-outline"
          title="No events"
          subtitle="There are no upcoming events."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Upcoming Events</Text>
        <Text style={styles.screenSubtitle}>
          Stay updated with what’s happening next
        </Text>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id.toString()}
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
