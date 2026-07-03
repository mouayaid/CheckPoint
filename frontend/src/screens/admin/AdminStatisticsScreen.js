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
  label,
  value,
  sub,
  colors,
  spacing,
  borderRadius,
  typography,
}) => (
  <View
    style={{
      flex: 1,
      minWidth: "46%",
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <Text
      style={{
        fontSize: typography.xs,
        color: colors.textSecondary,
        fontFamily: typography.fontFamily?.medium,
      }}
    >
      {label}
    </Text>
    <Text
      style={{
        marginTop: 4,
        fontSize: typography.xxl,
        fontWeight: "700",
        color: colors.textPrimary,
        fontFamily: typography.fontFamily?.bold,
      }}
    >
      {value ?? "-"}
    </Text>
    {sub ? (
      <Text
        style={{
          marginTop: 4,
          fontSize: typography.xs,
          color: colors.textMuted,
        }}
      >
        {sub}
      </Text>
    ) : null}
  </View>
);

const StatusList = ({
  title,
  items,
  colors,
  spacing,
  borderRadius,
  typography,
}) => {
  if (!items?.length) return null;
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text
        style={{
          fontSize: typography.sm,
          fontWeight: "600",
          color: colors.textSecondary,
          marginBottom: spacing.sm,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        {items.map((row, i) => (
          <View
            key={`${row.status}-${i}`}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: colors.border,
            }}
          >
            <Text
              style={{ color: colors.textPrimary, fontSize: typography.sm }}
            >
              {row.status ?? row.Status}
            </Text>
            <Text
              style={{
                fontWeight: "700",
                color: colors.primary,
                fontSize: typography.sm,
              }}
            >
              {row.count ?? row.Count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default function AdminStatisticsScreen() {
  const { colors, spacing, typography, borderRadius, darkMode } = useTheme();
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
  const [chatbotVisible, setChatbotVisible] = useState(false);

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
        filterCard: {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.lg,
        },
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
        chatbotButton: {
          position: "absolute",
          right: 20,
          bottom: 20,
          width: 60,
          height: 60,
          borderRadius: 30,
          justifyContent: "center",
          alignItems: "center",
          elevation: 6,
        },
      }),
    [colors, spacing, typography, borderRadius],
  );

  const users = stats?.users ?? stats?.Users;
  const infra = stats?.infrastructure ?? stats?.Infrastructure;

  return (
    <View style={[styles.container, { paddingTop: spacing.sm }]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.xl) + 88,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchStats}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.filterCard}>
          <Text
            style={{
              fontSize: typography.sm,
              fontWeight: "600",
              color: colors.textSecondary,
              marginBottom: spacing.sm,
            }}
          >
            Période rapide
          </Text>
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

          <Text
            style={{
              fontSize: typography.sm,
              fontWeight: "600",
              color: colors.textSecondary,
              marginTop: spacing.md,
              marginBottom: spacing.sm,
            }}
          >
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

          <Text
            style={{
              fontSize: typography.sm,
              fontWeight: "600",
              color: colors.textSecondary,
              marginTop: spacing.md,
              marginBottom: spacing.sm,
            }}
          >
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
            style={{
              marginTop: spacing.md,
              backgroundColor: colors.primary,
              paddingVertical: spacing.sm,
              borderRadius: borderRadius.md,
              alignItems: "center",
            }}
            onPress={() => {
              setPresetId("custom");
              fetchStats();
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontWeight: "700",
                fontSize: typography.sm,
              }}
            >
              Appliquer les filtres
            </Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View
            style={{
              padding: spacing.md,
              backgroundColor: (colors.error ?? "#ef4444") + "15",
              borderRadius: borderRadius.md,
              marginBottom: spacing.md,
            }}
          >
            <Text
              style={{
                color: colors.error ?? "#b91c1c",
                fontSize: typography.sm,
              }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {loading && !stats ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 24 }}
          />
        ) : null}

        {stats ? (
          <>
            <Text style={styles.sectionTitle}>Utilisateurs</Text>
            <Text
              style={{
                fontSize: typography.xs,
                color: colors.textMuted,
                marginBottom: spacing.sm,
              }}
            >
              Période API : {(stats.from ?? stats.From)?.slice?.(0, 10) ?? "—"}{" "}
              → {(stats.to ?? stats.To)?.slice?.(0, 10) ?? "—"}
              {(stats.departmentId ?? stats.DepartmentId) != null
                ? ` · Dépt. #${stats.departmentId ?? stats.DepartmentId}`
                : " · Tous départements"}
            </Text>
            <View style={styles.row}>
              <StatCard
                label="Total"
                value={users?.total ?? users?.Total}
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
              <StatCard
                label="Actifs"
                value={users?.active ?? users?.Active}
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
            </View>
            <View style={[styles.row, { marginTop: spacing.sm }]}>
              <StatCard
                label="En attente validation"
                value={users?.pendingApproval ?? users?.PendingApproval}
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
              <StatCard
                label="Inscrits sur la période"
                value={users?.registeredInPeriod ?? users?.RegisteredInPeriod}
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
            </View>

            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
              Infrastructure
            </Text>
            <View style={styles.row}>
              <StatCard
                label="Départements"
                value={infra?.departments ?? infra?.Departments}
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
              <StatCard
                label="Salles"
                value={infra?.rooms ?? infra?.Rooms}
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
            </View>
            <View style={[styles.row, { marginTop: spacing.sm }]}>
              <StatCard
                label="Tables"
                value={infra?.officeTables ?? infra?.OfficeTables}
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
              <StatCard
                label="Sièges"
                value={infra?.seats ?? infra?.Seats}
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
            </View>

            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
              Activité (période)
            </Text>
            <View style={styles.row}>
              <StatCard
                label="Congés (chevauch.)"
                value={
                  stats.leaveRequestsOverlappingPeriod ??
                  stats.LeaveRequestsOverlappingPeriod
                }
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
              <StatCard
                label="Rés. salles (chevauch.)"
                value={
                  stats.roomReservationsOverlappingPeriod ??
                  stats.RoomReservationsOverlappingPeriod
                }
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
            </View>

            <View style={[styles.row, { marginTop: spacing.sm }]}>
              <StatCard
                label="Rés. sièges (jours)"
                value={
                  stats.seatReservationsInPeriod ??
                  stats.SeatReservationsInPeriod
                }
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
              <StatCard
                label="Demandes générales"
                value={
                  stats.generalRequestsCreatedInPeriod ??
                  stats.GeneralRequestsCreatedInPeriod
                }
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
            </View>

            <View style={[styles.row, { marginTop: spacing.sm }]}>
              <StatCard
                label="Événements (début)"
                value={
                  stats.eventsStartingInPeriod ?? stats.EventsStartingInPeriod
                }
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
            </View>

            <View style={[styles.row, { marginTop: spacing.sm }]}>
              <StatCard
                label="Participants évén."
                value={
                  stats.eventParticipantsForEventsInPeriod ??
                  stats.EventParticipantsForEventsInPeriod
                }
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
              <StatCard
                label="Annonces créées"
                value={
                  stats.announcementsCreatedInPeriod ??
                  stats.AnnouncementsCreatedInPeriod
                }
                colors={colors}
                spacing={spacing}
                borderRadius={borderRadius}
                typography={typography}
              />
            </View>

            <StatusList
              title="Congés par statut"
              items={stats.leaveByStatus ?? stats.LeaveByStatus}
              colors={colors}
              spacing={spacing}
              borderRadius={borderRadius}
              typography={typography}
            />

            <StatusList
              title="Réservations de salle par statut"
              items={
                stats.roomReservationByStatus ?? stats.RoomReservationByStatus
              }
              colors={colors}
              spacing={spacing}
              borderRadius={borderRadius}
              typography={typography}
            />

            <StatusList
              title="Réservations de siège par statut"
              items={
                stats.seatReservationByStatus ?? stats.SeatReservationByStatus
              }
              colors={colors}
              spacing={spacing}
              borderRadius={borderRadius}
              typography={typography}
            />

            <StatusList
              title="Demandes générales par statut"
              items={
                stats.generalRequestByStatus ?? stats.GeneralRequestByStatus
              }
              colors={colors}
              spacing={spacing}
              borderRadius={borderRadius}
              typography={typography}
            />
          </>
        ) : null}
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
      <TouchableOpacity
        style={[
          styles.chatbotButton,
          {
            backgroundColor: colors.primary,
            bottom: insets.bottom + 20,
          },
        ]}
        onPress={() => setChatbotVisible(true)}
      >
        <Ionicons name="sparkles" size={28} color="#fff" />
      </TouchableOpacity>

      <ChatbotModal
        visible={chatbotVisible}
        onClose={() => setChatbotVisible(false)}
      />
    </View>
  );
}
