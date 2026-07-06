import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Modal,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";
import { adminStatisticsService } from "../../services/api/adminStatisticsService";
import { adminUserService } from "../../services/api/adminUserService";
import ChatbotModal from "../../components/dashboard/ChatbotModal";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const toYmd = (d) => {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
    x.getDate(),
  ).padStart(2, "0")}`;
};

const startOfMonth = (d) => {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const presets = [
  {
    id: "7d",
    label: "7 jours",
    apply: () => {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = addDays(to, -6);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    },
  },
  {
    id: "30d",
    label: "30 jours",
    apply: () => {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = addDays(to, -29);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    },
  },
  {
    id: "month",
    label: "Ce mois",
    apply: () => {
      const now = new Date();
      const from = startOfMonth(now);
      const to = new Date(now);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    },
  },
  {
    id: "quarter",
    label: "90 jours",
    apply: () => {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = addDays(to, -89);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    },
  },
  {
    id: "year",
    label: "365 jours",
    apply: () => {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = addDays(to, -364);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    },
  },
];

const StatCard = ({
  icon,
  label,
  value,
  sub,
  colors,
  styles,
  compact = false,
}) => (
  <View style={[styles.statCard, compact && styles.statCardCompact]}>
    <View style={styles.statIconBadge}>
      <Ionicons name={icon} size={compact ? 17 : 20} color={colors.primary} />
    </View>
    <Text style={[styles.statValue, compact && styles.statValueCompact]}>
      {value ?? "—"}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
    {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
  </View>
);

const StatusList = ({
  title,
  items,
  colors,
  styles,
}) => {
  const [expanded, setExpanded] = useState(false);
  if (!items?.length) return null;
  const total = items.reduce(
    (sum, row) => sum + Number(row.count ?? row.Count ?? 0),
    0,
  );

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((current) => !current);
  };

  return (
    <View style={styles.statusCard}>
      <TouchableOpacity style={styles.statusHeader} onPress={toggle}>
        <Text style={styles.statusTitle}>{title}</Text>
        <View style={styles.statusTotalBadge}>
          <Text style={styles.statusTotalText}>{total}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.statusBody}>
          {items.map((row, i) => (
            <View key={`${row.status ?? row.Status}-${i}`} style={styles.statusRow}>
              <Text style={styles.statusName}>{row.status ?? row.Status}</Text>
              <Text style={styles.statusCount}>{row.count ?? row.Count}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const AnalyticsDashboard = ({ stats, colors, styles }) => {
  const users = stats?.users ?? stats?.Users;
  const infra = stats?.infrastructure ?? stats?.Infrastructure;
  const cards = {
    overview: [
      ["people-outline", "Utilisateurs actifs", users?.active ?? users?.Active],
      ["person-add-outline", "Comptes en attente", users?.pendingApproval ?? users?.PendingApproval],
      ["document-text-outline", "Demandes générales", stats.generalRequestsCreatedInPeriod ?? stats.GeneralRequestsCreatedInPeriod],
      ["desktop-outline", "Réservations de sièges", stats.seatReservationsInPeriod ?? stats.SeatReservationsInPeriod],
    ],
    infrastructure: [
      ["business-outline", "Départements", infra?.departments ?? infra?.Departments],
      ["business-outline", "Salles", infra?.rooms ?? infra?.Rooms],
      ["grid-outline", "Tables", infra?.officeTables ?? infra?.OfficeTables],
      ["desktop-outline", "Sièges", infra?.seats ?? infra?.Seats],
    ],
    activity: [
      ["calendar-outline", "Demandes de congé", stats.leaveRequestsOverlappingPeriod ?? stats.LeaveRequestsOverlappingPeriod],
      ["business-outline", "Réservations de salles", stats.roomReservationsOverlappingPeriod ?? stats.RoomReservationsOverlappingPeriod],
      ["desktop-outline", "Réservations de sièges", stats.seatReservationsInPeriod ?? stats.SeatReservationsInPeriod],
      ["document-text-outline", "Demandes générales", stats.generalRequestsCreatedInPeriod ?? stats.GeneralRequestsCreatedInPeriod],
      ["calendar-number-outline", "Événements", stats.eventsStartingInPeriod ?? stats.EventsStartingInPeriod],
      ["people-circle-outline", "Participants aux événements", stats.eventParticipantsForEventsInPeriod ?? stats.EventParticipantsForEventsInPeriod],
      ["megaphone-outline", "Annonces publiées", stats.announcementsCreatedInPeriod ?? stats.AnnouncementsCreatedInPeriod],
    ],
  };

  const renderCards = (items, compact = false) => (
    <View style={styles.row}>
      {items.map(([icon, label, value]) => (
        <StatCard
          key={label}
          icon={icon}
          label={label}
          value={value}
          compact={compact}
          colors={colors}
          styles={styles}
        />
      ))}
    </View>
  );

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
        {renderCards(cards.overview)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Infrastructure</Text>
        {renderCards(cards.infrastructure, true)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activité sur la période</Text>
        {renderCards(cards.activity, true)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Répartition par statut</Text>
        <StatusList title="Congés par statut" items={stats.leaveByStatus ?? stats.LeaveByStatus} colors={colors} styles={styles} />
        <StatusList title="Réservations de salle par statut" items={stats.roomReservationByStatus ?? stats.RoomReservationByStatus} colors={colors} styles={styles} />
        <StatusList title="Réservations de siège par statut" items={stats.seatReservationByStatus ?? stats.SeatReservationByStatus} colors={colors} styles={styles} />
        <StatusList title="Demandes générales par statut" items={stats.generalRequestByStatus ?? stats.GeneralRequestByStatus} colors={colors} styles={styles} />
      </View>
    </>
  );
};

export default function AdminStatisticsScreen() {
  const { colors, spacing, typography, borderRadius, shadows, darkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [presetId, setPresetId] = useState("30d");
  const [from, setFrom] = useState(() => addDays(new Date(), -29));
  const [to, setTo] = useState(() => new Date());
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [picker, setPicker] = useState(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const applyPreset = useCallback((id) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    const { from: f, to: t } = p.apply();
    setFrom(f);
    setTo(t);
    setPresetId(id);
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await adminUserService.getDepartments();
      const list = Array.isArray(res) ? res : [];
      setDepartments(
        list.map((d) => ({
          id: d.id ?? d.Id,
          name: d.name ?? d.Name ?? "-",
        })),
      );
    } catch {
      setDepartments([]);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const yFrom = toYmd(from);
      const yTo = toYmd(to);
      const data = await adminStatisticsService.getStatistics({
        from: yFrom,
        to: yTo,
        departmentId: departmentId === "" ? undefined : Number(departmentId),
      });
      setStats(data);
    } catch (e) {
      setError(e?.message ?? "Impossible de charger les statistiques");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, departmentId]);

  useFocusEffect(
    useCallback(() => {
      loadDepartments();
    }, [loadDepartments]),
  );

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats]),
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: {
          paddingHorizontal: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.xl) + 176,
        },
        screenHeader: { paddingVertical: spacing.lg },
        screenTitle: {
          color: colors.textPrimary,
          fontSize: typography.xxl,
          fontWeight: typography.bold,
        },
        screenSubtitle: {
          color: colors.textSecondary,
          fontSize: typography.sm,
          marginTop: spacing.xs,
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.md,
        },
        chipScroll: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        chip: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
        },
        sectionTitle: {
          fontSize: typography.lg,
          fontWeight: "700",
          color: colors.textPrimary,
          marginBottom: spacing.sm,
        },
        row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
        section: { marginTop: spacing.xl },
        statCard: {
          flexGrow: 1,
          flexBasis: "46%",
          minWidth: "46%",
          minHeight: 148,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.sm,
        },
        statCardCompact: { minHeight: 126 },
        statIconBadge: {
          width: 38,
          height: 38,
          borderRadius: borderRadius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primaryLight,
          marginBottom: spacing.md,
        },
        statValue: {
          color: colors.textPrimary,
          fontSize: typography.xxl,
          fontWeight: typography.bold,
        },
        statValueCompact: { fontSize: typography.xl },
        statLabel: {
          color: colors.textSecondary,
          fontSize: typography.sm,
          fontWeight: typography.semibold,
          marginTop: spacing.xs,
        },
        statSub: { color: colors.textMuted, fontSize: typography.xs, marginTop: 3 },
        filterCard: {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.lg,
          ...shadows.sm,
        },
        filterSummary: {
          minHeight: 58,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          ...shadows.sm,
        },
        filterSummaryIcon: {
          width: 38,
          height: 38,
          borderRadius: borderRadius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primaryLight,
        },
        filterSummaryText: {
          flex: 1,
          color: colors.textSecondary,
          fontSize: typography.sm,
          fontWeight: typography.semibold,
        },
        filterLabel: {
          fontSize: typography.sm,
          fontWeight: typography.semibold,
          color: colors.textSecondary,
          marginBottom: spacing.sm,
        },
        filterLabelSpaced: { marginTop: spacing.md },
        dateBtn: {
          flex: 1,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: borderRadius.md,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pickerWrap: {
          marginTop: spacing.sm,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        },
        applyButton: {
          minHeight: 48,
          marginTop: spacing.md,
          borderRadius: borderRadius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
        },
        applyButtonText: {
          color: colors.textOnPrimary,
          fontWeight: typography.bold,
          fontSize: typography.sm,
        },
        loadingState: { alignItems: "center", paddingVertical: spacing.xxl },
        loadingText: { color: colors.textSecondary, fontSize: typography.sm, marginTop: spacing.md },
        errorCard: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.md,
          backgroundColor: colors.errorLight,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.error,
        },
        errorText: { flex: 1, color: colors.error, fontSize: typography.sm },
        retryButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
        retryText: { color: colors.error, fontSize: typography.sm, fontWeight: typography.bold },
        statusCard: {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          marginBottom: spacing.sm,
        },
        statusHeader: {
          minHeight: 56,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        statusTitle: { flex: 1, color: colors.textPrimary, fontSize: typography.sm, fontWeight: typography.semibold },
        statusTotalBadge: { minWidth: 32, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full, backgroundColor: colors.primaryLight, alignItems: "center" },
        statusTotalText: { color: colors.primary, fontSize: typography.xs, fontWeight: typography.bold },
        statusBody: { borderTopWidth: 1, borderTopColor: colors.border },
        statusRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
        statusName: { color: colors.textSecondary, fontSize: typography.sm },
        statusCount: { color: colors.primary, fontSize: typography.sm, fontWeight: typography.bold },
      }),
    [colors, spacing, typography, borderRadius, shadows, insets.bottom],
  );

  const activePreset = presets.find((item) => item.id === presetId);
  const periodSummary = activePreset?.label ?? `${toYmd(from)} → ${toYmd(to)}`;
  const departmentSummary =
    departments.find((item) => String(item.id) === String(departmentId))?.name ??
    "Tous les départements";

  return (
    <View style={[styles.container, { paddingTop: spacing.sm }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchStats}
            tintColor={colors.primary}
          />
        }
      >
        <TouchableOpacity
          style={styles.filterSummary}
          onPress={() => setFiltersExpanded((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel="Afficher ou masquer les filtres"
        >
          <View style={styles.filterSummaryIcon}>
            <Ionicons name="options-outline" size={20} color={colors.primary} />
          </View>
          <Text style={styles.filterSummaryText} numberOfLines={2}>
            {periodSummary} · {departmentSummary}
          </Text>
          <Ionicons
            name={filtersExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {filtersExpanded && <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Période rapide</Text>
          <View style={styles.chipScroll}>
            {presets.map((p) => {
              const active = presetId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => applyPreset(p.id)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active
                        ? colors.primary + "18"
                        : colors.background,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: typography.xs,
                      fontWeight: "600",
                      color: active ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.filterLabel, styles.filterLabelSpaced]}>
            Dates personnalisées
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setPicker("from")}
            >
              <Text
                style={{ fontSize: typography.xs, color: colors.textSecondary }}
              >
                Du
              </Text>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textPrimary,
                  marginTop: 2,
                }}
              >
                {toYmd(from) ?? "-"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setPicker("to")}
            >
              <Text
                style={{ fontSize: typography.xs, color: colors.textSecondary }}
              >
                Au
              </Text>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textPrimary,
                  marginTop: 2,
                }}
              >
                {toYmd(to) ?? "-"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.filterLabel, styles.filterLabelSpaced]}>
            Département
          </Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={departmentId}
              onValueChange={(v) => setDepartmentId(v)}
              dropdownIconColor={colors.textPrimary}
              style={{ color: colors.textPrimary }}
            >
              <Picker.Item label="Tous les départements" value="" />
              {departments.map((d) => (
                <Picker.Item
                  key={String(d.id)}
                  label={d.name}
                  value={String(d.id)}
                />
              ))}
            </Picker>
          </View>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => {
              setPresetId("custom");
              fetchStats();
              setFiltersExpanded(false);
            }}
          >
            <Text style={styles.applyButtonText}>
              Appliquer les filtres
            </Text>
          </TouchableOpacity>
        </View>}

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchStats}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading && !stats ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Chargement des statistiques...</Text>
          </View>
        ) : null}

        {stats ? <AnalyticsDashboard stats={stats} colors={colors} styles={styles} /> : null}

      </ScrollView>

      {picker && Platform.OS === "android" ? (
        <DateTimePicker
          value={picker === "from" ? from : to}
          mode="date"
          display="default"
          onChange={(event, selected) => {
            setPicker(null);
            if (event.type === "dismissed" || !selected) return;
            setPresetId("custom");
            if (picker === "from") setFrom(selected);
            else setTo(selected);
          }}
        />
      ) : null}

      {picker && Platform.OS === "ios" ? (
        <Modal
          transparent
          animationType="slide"
          visible
          onRequestClose={() => setPicker(null)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
            activeOpacity={1}
            onPress={() => setPicker(null)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: borderRadius.lg,
                  borderTopRightRadius: borderRadius.lg,
                  paddingBottom: insets.bottom + spacing.md,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    padding: spacing.md,
                  }}
                >
                  <TouchableOpacity onPress={() => setPicker(null)}>
                    <Text
                      style={{
                        color: colors.primary,
                        fontWeight: "700",
                        fontSize: typography.base,
                      }}
                    >
                      OK
                    </Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={picker === "from" ? from : to}
                  mode="date"
                  display="spinner"
                  themeVariant={darkMode ? "dark" : "light"}
                  onChange={(_, selected) => {
                    if (!selected) return;
                    setPresetId("custom");
                    if (picker === "from") setFrom(selected);
                    else setTo(selected);
                  }}
                />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : null}
      <ChatbotModal
        statisticsFilters={{
          from: toYmd(from),
          to: toYmd(to),
          departmentId: departmentId === "" ? null : Number(departmentId),
        }}
      />
    </View>
  );
}
