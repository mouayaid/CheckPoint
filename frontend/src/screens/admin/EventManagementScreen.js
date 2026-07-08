import logger from "../../utils/logger";
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Pressable,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { useRoles } from "../../hooks/useRoles";
import { eventService } from "../../services/api";
import { Input } from "../../components";
import EmptyState from "../../components/EmptyState";
import FeedbackModal from "../../components/FeedbackModal";
import ConfirmActionModal from "../../components/common/ConfirmActionModal";

const EVENT_TYPES = [
  { value: 1, key: "meeting", label: "Réunion", color: "#3B82F6" },
  { value: 2, key: "training", label: "Formation", color: "#10B981" },
  { value: 3, key: "workshop", label: "Atelier", color: "#F59E0B" },
  { value: 4, key: "conference", label: "Conférence", color: "#8B5CF6" },
  { value: 5, key: "social", label: "Social", color: "#EC4899" },
  { value: 6, key: "announcement", label: "Annonce", color: "#6B7280" },
  { value: 7, key: "other", label: "Autre", color: "#9CA3AF" },
];

const EVENT_TYPE_BY_NAME = {
  meeting: 1,
  réunion: 1,
  reunion: 1,
  training: 2,
  formation: 2,
  workshop: 3,
  atelier: 3,
  conference: 4,
  conférence: 4,
  social: 5,
  announcement: 6,
  annonce: 6,
  other: 7,
  autre: 7,
};

const DESTRUCTIVE_COLOR = "#EF4444";
const TUNISIA_TIME_ZONE = "Africa/Tunis";
const TUNISIA_UTC_OFFSET_MINUTES = 60;

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

const parseDateKeyCarrier = (dateKey) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const createTunisiaDateTimeCarrier = (date = new Date()) => {
  const parts = getTunisiaParts(date);
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  );
};

const createDateTimeCarrierFromApiInstant = (value, fallback = new Date()) => {
  const instant = parseApiInstant(value);
  if (!instant || Number.isNaN(instant.getTime())) return fallback;

  return createTunisiaDateTimeCarrier(instant);
};

const makeTunisiaInstantFromCarrier = (date) =>
  new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      0,
      0,
    ) -
      TUNISIA_UTC_OFFSET_MINUTES * 60000,
  );

const formatTunisiaLocalDateTimePayload = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}T${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
const PAST_EVENT_START_MESSAGE = "La date de début ne peut pas être dans le passé.";
const END_AFTER_START_MESSAGE = "La fin doit être après le début";

const normalizeEventType = (value) => {
  if (typeof value === "number" && EVENT_TYPES.some((t) => t.value === value)) {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (EVENT_TYPES.some((t) => t.value === numeric)) return numeric;

    const normalized = value.trim().toLowerCase();
    return EVENT_TYPE_BY_NAME[normalized] ?? 7;
  }

  return 7;
};

const getEventSaveErrorMessage = (error) => {
  const data = error?.data ?? error?.response?.data;
  const errors = data?.errors ?? data?.Errors;

  if (Array.isArray(errors) && errors.length > 0) {
    return errors.join("\n");
  }

  if (errors && typeof errors === "object") {
    const validationMessages = Object.values(errors).flat().filter(Boolean);

    if (validationMessages.length > 0) {
      return validationMessages.join("\n");
    }
  }

  return (
    data?.message ??
    data?.Message ??
    (typeof data === "string" ? data : null) ??
    error?.message ??
    "Sauvegarde échouée"
  );
};

const getEventId = (event) => event?.id ?? event?.Id;

const getResponsePayload = (response) => {
  const body = response?.data ?? response;
  return body?.data ?? body?.Data ?? body;
};

const getResponseArray = (response) => {
  const payload = getResponsePayload(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  return [];
};

const normalizeRsvpStatus = (status) => {
  if (status == null) return null;

  if (typeof status === "number") {
    if (status === 2) return "Going";
    if (status === 3) return "NotGoing";
    if (status === 4) return "Maybe";
    return null;
  }

  const normalized = String(status)
    .trim()
    .replace(/[_\s-]/g, "")
    .toLowerCase();

  if (["going", "accepted", "accept", "participer", "participera"].includes(normalized)) {
    return "Going";
  }

  if (
    ["notgoing", "declined", "decline", "nepasparticiper", "neparticiperapas"].includes(
      normalized,
    )
  ) {
    return "NotGoing";
  }

  if (["maybe", "peutetre", "peutêtre"].includes(normalized)) {
    return "Maybe";
  }

  return null;
};

const getRsvpStatusLabel = (status) =>
  ({
    Going: "Participe",
    NotGoing: "Ne participe pas",
    Maybe: "Peut-être",
  })[normalizeRsvpStatus(status)] ?? "Réponse";

const getEventCountValue = (event, camelKey, pascalKey) => {
  const count = Number(event?.[camelKey] ?? event?.[pascalKey] ?? 0);
  return Number.isNaN(count) ? 0 : count;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

const formatTime = (date) =>
  date
    ? date instanceof Date
      ? date.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : parseApiInstant(date).toLocaleTimeString("fr-FR", {
          timeZone: TUNISIA_TIME_ZONE,
          hour: "2-digit",
          minute: "2-digit",
        })
    : "--:--";

const formatApiTime = (date) =>
  date
    ? parseApiInstant(date).toLocaleTimeString("fr-FR", {
        timeZone: TUNISIA_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";

const formatDate = (date) =>
  date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const formatSectionDate = (date) => {
  const today = startOfDay(createTunisiaDateTimeCarrier());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (isSameDay(date, today)) return "AUJOURD'HUI";
  if (isSameDay(date, tomorrow)) return "DEMAIN";

  return formatDate(date).toUpperCase();
};

const formatDateValue = (date) =>
  date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatDuration = (start, end) => {
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours && rest) return `${hours} h ${rest} min`;
  if (hours) return `${hours} h`;
  return `${rest} min`;
};

const getScheduleValidationMessage = (startDateTime, endDateTime) => {
  const startInstant = makeTunisiaInstantFromCarrier(startDateTime);
  const endInstant = makeTunisiaInstantFromCarrier(endDateTime);

  if (startInstant.getTime() < Date.now()) {
    return PAST_EVENT_START_MESSAGE;
  }

  if (endInstant <= startInstant) {
    return END_AFTER_START_MESSAGE;
  }

  return null;
};

const EventAgendaCard = ({
  event,
  styles,
  colors,
  onOpenActions,
  deleting,
}) => {
  const typeInfo =
    EVENT_TYPES.find((t) => t.value === normalizeEventType(event.type)) ||
    EVENT_TYPES[6];
  const endInstant = parseApiInstant(event.endDateTime);
  const isPast = endInstant && endInstant < new Date();
  const rsvpCount =
    getEventCountValue(event, "goingCount", "GoingCount") +
    getEventCountValue(event, "notGoingCount", "NotGoingCount") +
    getEventCountValue(event, "maybeCount", "MaybeCount");

  return (
    <View style={[styles.agendaCard, isPast && styles.agendaCardPast]}>
      <View style={styles.timeColumn}>
        <Text style={styles.startTime}>{formatApiTime(event.startDateTime)}</Text>
        <Text style={styles.endTime}>{formatApiTime(event.endDateTime)}</Text>
      </View>

      <View style={[styles.typeAccent, { backgroundColor: typeInfo.color }]} />

      <View style={styles.agendaMain}>
        <View style={styles.agendaTitleRow}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {event.title}
          </Text>
          {isPast && (
            <View style={styles.pastBadge}>
              <Text style={styles.pastText}>Passé</Text>
            </View>
          )}
        </View>

        <View style={styles.metaLine}>
          <View
            style={[
              styles.typeDot,
              { backgroundColor: `${typeInfo.color}25` },
            ]}
          >
            <View style={[styles.typeDotInner, { backgroundColor: typeInfo.color }]} />
          </View>
          <Text style={[styles.typeLabel, { color: typeInfo.color }]}>
            {typeInfo.label}
          </Text>
        </View>

        {!!event.description && (
          <Text style={styles.description} numberOfLines={2}>
            {event.description}
          </Text>
        )}

        <View style={styles.badgesRow}>
          {event.isMandatory && (
            <View style={styles.softBadge}>
              <Ionicons
                name="alert-circle-outline"
                size={13}
                color={colors.warning}
              />
              <Text style={styles.softBadgeText}>Obligatoire</Text>
            </View>
          )}

          {event.rsvpEnabled && (
            <View style={styles.softBadge}>
              <Ionicons
                name="checkmark-circle-outline"
                size={13}
                color={colors.success}
              />
              <Text style={styles.softBadgeText}>
                RSVP{rsvpCount > 0 ? ` · ${rsvpCount}` : ""}
              </Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.moreBtn}
        onPress={() => onOpenActions(event)}
        disabled={deleting}
        activeOpacity={0.75}
      >
        {deleting ? (
          <ActivityIndicator size="small" color={DESTRUCTIVE_COLOR} />
        ) : (
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const EventActionSheet = ({
  visible,
  event,
  onClose,
  onEdit,
  onDelete,
  onViewRsvps,
  showRsvpAction,
  deleting,
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
}) => {
  const s = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.overlay,
        },
        sheet: {
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.lg,
        },
        handle: {
          width: 38,
          height: 4,
          alignSelf: "center",
          marginBottom: spacing.lg,
          borderRadius: borderRadius.full,
          backgroundColor: colors.border,
        },
        title: {
          fontSize: typography.base,
          fontWeight: typography.bold,
          color: colors.text,
          marginBottom: spacing.xs,
        },
        subtitle: {
          fontSize: typography.sm,
          color: colors.textSecondary,
          marginBottom: spacing.lg,
        },
        action: {
          minHeight: 50,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surfaceMuted,
          marginBottom: spacing.sm,
        },
        actionText: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.text,
        },
        deleteText: {
          color: DESTRUCTIVE_COLOR,
        },
        disabled: {
          opacity: 0.6,
        },
      }),
    [colors, spacing, typography, borderRadius, shadows],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title} numberOfLines={1}>
            {event?.title ?? "Événement"}
          </Text>
          <Text style={s.subtitle}>Choisissez une action</Text>

          {showRsvpAction ? (
            <TouchableOpacity
              style={s.action}
              onPress={onViewRsvps}
              disabled={deleting}
              activeOpacity={0.8}
            >
              <Ionicons
                name="people-circle-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={s.actionText}>Voir réponses</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={s.action}
            onPress={onEdit}
            disabled={deleting}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <Text style={s.actionText}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.action, deleting && s.disabled]}
            onPress={onDelete}
            disabled={deleting}
            activeOpacity={0.8}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={DESTRUCTIVE_COLOR} />
            ) : (
              <Ionicons name="trash-outline" size={20} color={DESTRUCTIVE_COLOR} />
            )}
            <Text style={[s.actionText, s.deleteText]}>Supprimer</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const RsvpResponsesModal = ({
  visible,
  event,
  responses,
  loading,
  error,
  onClose,
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
}) => {
  const sections = useMemo(() => {
    const grouped = {
      Going: [],
      NotGoing: [],
      Maybe: [],
    };

    responses.forEach((response) => {
      const status = normalizeRsvpStatus(response.status ?? response.Status);
      if (status && grouped[status]) {
        grouped[status].push(response);
      }
    });

    const nextSections = [
      {
        key: "Going",
        title: "Participants",
        rows: grouped.Going,
        color: colors.success,
      },
      {
        key: "NotGoing",
        title: "Ne participent pas",
        rows: grouped.NotGoing,
        color: DESTRUCTIVE_COLOR,
      },
    ];

    if (grouped.Maybe.length > 0) {
      nextSections.push({
        key: "Maybe",
        title: "Peut-être",
        rows: grouped.Maybe,
        color: colors.warning,
      });
    }

    return nextSections;
  }, [colors.success, colors.warning, responses]);

  const counts = useMemo(
    () =>
      responses.reduce(
        (acc, response) => {
          const status = normalizeRsvpStatus(response.status ?? response.Status);
          if (status && acc[status] != null) acc[status] += 1;
          return acc;
        },
        { Going: 0, NotGoing: 0, Maybe: 0 },
      ),
    [responses],
  );

  const eventStart = event?.startDateTime
    ? createDateTimeCarrierFromApiInstant(event.startDateTime)
    : null;
  const eventSubtitle =
    eventStart && !Number.isNaN(eventStart.getTime())
      ? `${event.title} · ${formatDate(eventStart)} ${formatTime(eventStart)}`
      : event?.title ?? "Événement";

  const s = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.overlay,
        },
        sheet: {
          maxHeight: "86%",
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.lg,
        },
        handle: {
          width: 38,
          height: 4,
          alignSelf: "center",
          marginBottom: spacing.lg,
          borderRadius: borderRadius.full,
          backgroundColor: colors.border,
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: spacing.md,
          marginBottom: spacing.md,
        },
        headerText: {
          flex: 1,
        },
        title: {
          fontSize: typography.lg,
          fontWeight: typography.bold,
          color: colors.text,
        },
        subtitle: {
          marginTop: 3,
          fontSize: typography.sm,
          color: colors.textSecondary,
          lineHeight: 19,
        },
        closeBtn: {
          width: 34,
          height: 34,
          borderRadius: borderRadius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceMuted,
        },
        countRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
        countPill: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 5,
          borderRadius: borderRadius.full,
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
        },
        countText: {
          fontSize: typography.xs,
          fontWeight: typography.semibold,
          color: colors.textSecondary,
        },
        centered: {
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing.xxl,
          gap: spacing.sm,
        },
        centeredText: {
          fontSize: typography.sm,
          color: colors.textSecondary,
          textAlign: "center",
        },
        errorText: {
          fontSize: typography.sm,
          fontWeight: typography.semibold,
          color: colors.error,
          textAlign: "center",
        },
        section: {
          marginTop: spacing.md,
        },
        sectionTitle: {
          fontSize: typography.xs,
          fontWeight: typography.bold,
          color: colors.textTertiary,
          marginBottom: spacing.sm,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.sm,
        },
        rowText: {
          flex: 1,
          minWidth: 0,
        },
        name: {
          fontSize: typography.sm,
          fontWeight: typography.semibold,
          color: colors.text,
        },
        email: {
          marginTop: 2,
          fontSize: typography.xs,
          color: colors.textSecondary,
        },
        respondedAt: {
          marginTop: 2,
          fontSize: typography.xs,
          color: colors.textTertiary,
        },
        badge: {
          flexShrink: 0,
          borderRadius: borderRadius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
        },
        badgeText: {
          fontSize: 10,
          fontWeight: typography.bold,
        },
      }),
    [colors, spacing, typography, borderRadius, shadows],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <View style={s.headerText}>
              <Text style={s.title}>Réponses RSVP</Text>
              <Text style={s.subtitle} numberOfLines={2}>
                {eventSubtitle}
              </Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={19} color={colors.text} />
            </TouchableOpacity>
          </View>

          {!loading && !error && responses.length > 0 ? (
            <View style={s.countRow}>
              <View style={s.countPill}>
                <Text style={s.countText}>Participent: {counts.Going}</Text>
              </View>
              <View style={s.countPill}>
                <Text style={s.countText}>
                  Ne participent pas: {counts.NotGoing}
                </Text>
              </View>
              {counts.Maybe > 0 ? (
                <View style={s.countPill}>
                  <Text style={s.countText}>Peut-être: {counts.Maybe}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {loading ? (
            <View style={s.centered}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={s.centeredText}>Chargement des réponses…</Text>
            </View>
          ) : error ? (
            <View style={s.centered}>
              <Ionicons name="alert-circle-outline" size={28} color={colors.error} />
              <Text style={s.errorText}>Impossible de charger les réponses.</Text>
            </View>
          ) : responses.length === 0 ? (
            <View style={s.centered}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={28}
                color={colors.textSecondary}
              />
              <Text style={s.centeredText}>Aucune réponse pour le moment.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {sections.map((section) =>
                section.rows.length > 0 ? (
                  <View key={section.key} style={s.section}>
                    <Text style={s.sectionTitle}>
                      {section.title} ({section.rows.length})
                    </Text>
                    {section.rows.map((response) => {
                      const fullName =
                        response.fullName ?? response.FullName ?? "Utilisateur";
                      const email = response.email ?? response.Email ?? "";
                      const status = response.status ?? response.Status;
                      const respondedAt =
                        response.respondedAt ?? response.RespondedAt ?? null;
                      const respondedAtInstant = respondedAt
                        ? parseApiInstant(respondedAt)
                        : null;
                      const dateLabel = respondedAt
                        ? respondedAtInstant.toLocaleString("fr-FR", {
                            timeZone: TUNISIA_TIME_ZONE,
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : null;

                      return (
                        <View
                          key={`${response.userId ?? response.UserId}-${section.key}`}
                          style={s.row}
                        >
                          <View style={s.rowText}>
                            <Text style={s.name} numberOfLines={1}>
                              {fullName}
                            </Text>
                            {!!email && (
                              <Text style={s.email} numberOfLines={1}>
                                {email}
                              </Text>
                            )}
                            {!!dateLabel && (
                              <Text style={s.respondedAt}>
                                Répondu le {dateLabel}
                              </Text>
                            )}
                          </View>
                          <View
                            style={[
                              s.badge,
                              { backgroundColor: `${section.color}18` },
                            ]}
                          >
                            <Text
                              style={[s.badgeText, { color: section.color }]}
                            >
                              {getRsvpStatusLabel(status)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null,
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const SchedulePickerRow = ({
  label,
  value,
  icon,
  onPress,
  disabled,
  styles,
  colors,
}) => (
  <TouchableOpacity
    style={[styles.scheduleRow, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.8}
  >
    <View style={styles.scheduleIcon}>
      <Ionicons name={icon} size={17} color={colors.primary} />
    </View>
    <View style={styles.scheduleText}>
      <Text style={styles.scheduleLabel}>{label}</Text>
      <Text style={styles.scheduleValue}>{value}</Text>
    </View>
    <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
  </TouchableOpacity>
);

const OptionSwitchRow = ({
  title,
  subtitle,
  helperText,
  value,
  onValueChange,
  disabled,
  muted,
  styles,
  colors,
}) => (
  <View style={[styles.optionRow, muted && styles.optionRowMuted]}>
    <View style={styles.optionText}>
      <Text style={[styles.optionTitle, muted && styles.optionTitleMuted]}>
        {title}
      </Text>
      <Text style={[styles.optionSubtitle, muted && styles.optionSubtitleMuted]}>
        {subtitle}
      </Text>
      {!!helperText && <Text style={styles.optionHelper}>{helperText}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor={colors.white}
    />
  </View>
);

const EditEventModal = ({
  visible,
  event,
  onClose,
  onSave,
  onFeedback,
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState(1);
  const [startDateTime, setStartDateTime] = useState(new Date());
  const [endDateTime, setEndDateTime] = useState(new Date());
  const [isMandatory, setIsMandatory] = useState(false);
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);

  React.useEffect(() => {
    if (visible && event) {
      const nextIsMandatory = event.isMandatory ?? event.IsMandatory ?? false;

      setTitle(event.title || event.Title || "");
      setDescription(event.description || event.Description || "");
      setType(normalizeEventType(event.type ?? event.Type ?? 1));
      setStartDateTime(
        createDateTimeCarrierFromApiInstant(
          event.startDateTime || event.StartDateTime,
          createTunisiaDateTimeCarrier(),
        ),
      );
      setEndDateTime(
        createDateTimeCarrierFromApiInstant(
          event.endDateTime || event.EndDateTime,
          createTunisiaDateTimeCarrier(new Date(Date.now() + 3600000)),
        ),
      );
      setIsMandatory(nextIsMandatory);
      setRsvpEnabled(
        nextIsMandatory
          ? false
          : event.rsvpEnabled ?? event.RsvpEnabled ?? event.RSVPEnabled ?? true,
      );
    } else if (visible) {
      const now = createTunisiaDateTimeCarrier();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);

      const end = new Date(now);
      end.setHours(end.getHours() + 1);

      setTitle("");
      setDescription("");
      setType(1);
      setStartDateTime(now);
      setEndDateTime(end);
      setIsMandatory(false);
      setRsvpEnabled(true);
    }
  }, [visible, event]);

  const validationMessage = useMemo(() => {
    return getScheduleValidationMessage(startDateTime, endDateTime);
  }, [startDateTime, endDateTime]);

  const validate = () => {
    if (!title.trim()) return "Titre requis";
    const scheduleError = getScheduleValidationMessage(startDateTime, endDateTime);
    if (scheduleError) return scheduleError;
    return null;
  };

  const handleMandatoryChange = (nextValue) => {
    setIsMandatory(nextValue);

    if (nextValue) {
      setRsvpEnabled(false);
    }
  };

  const updateDatePart = (target, selectedDate) => {
    const source = target.startsWith("start") ? startDateTime : endDateTime;
    const updated = new Date(source);
    updated.setFullYear(selectedDate.getFullYear());
    updated.setMonth(selectedDate.getMonth());
    updated.setDate(selectedDate.getDate());

    if (target.startsWith("start")) setStartDateTime(updated);
    else setEndDateTime(updated);
  };

  const updateTimePart = (target, selectedDate) => {
    const source = target.startsWith("start") ? startDateTime : endDateTime;
    const updated = new Date(source);
    updated.setHours(selectedDate.getHours());
    updated.setMinutes(selectedDate.getMinutes());
    updated.setSeconds(0, 0);

    if (target.startsWith("start")) setStartDateTime(updated);
    else setEndDateTime(updated);
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      onFeedback?.("error", "Erreur", error);
      return;
    }

    setSaving(true);

    try {
      const eventId = getEventId(event);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        type,
        startDateTime: formatTunisiaLocalDateTimePayload(startDateTime),
        endDateTime: formatTunisiaLocalDateTimePayload(endDateTime),
        isMandatory,
        rsvpEnabled: isMandatory ? false : rsvpEnabled,
      };

      logger.debug("EVENT EDIT SAVE SUBMIT:", {
        selectedEvent: event,
        eventId,
        payload,
        startDateTime: payload.startDateTime,
        endDateTime: payload.endDateTime,
        startDateReadable: startDateTime.toString(),
        endDateReadable: endDateTime.toString(),
      });

      await onSave(eventId, payload, event);
      onClose();
    } catch (e) {
      onFeedback?.("error", "Erreur", getEventSaveErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        sheet: {
          maxHeight: "94%",
          backgroundColor: colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          ...shadows.lg,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xl,
          paddingBottom: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerText: {
          flex: 1,
          paddingRight: spacing.md,
        },
        title: {
          fontSize: typography.xl,
          fontWeight: typography.bold,
          color: colors.text,
        },
        subtitle: {
          marginTop: 3,
          fontSize: typography.sm,
          color: colors.textSecondary,
        },
        closeBtn: {
          width: 38,
          height: 38,
          borderRadius: borderRadius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceMuted,
        },
        scroll: {
          maxHeight: 520,
        },
        scrollContent: {
          padding: spacing.xl,
          paddingBottom: spacing.lg,
        },
        section: {
          marginBottom: spacing.xl,
        },
        sectionTitle: {
          fontSize: typography.sm,
          fontWeight: typography.bold,
          color: colors.text,
          marginBottom: spacing.md,
          textTransform: "uppercase",
        },
        label: {
          fontSize: typography.sm,
          fontWeight: typography.semibold,
          color: colors.textSecondary,
          marginBottom: 6,
        },
        typeScroller: {
          marginHorizontal: -spacing.xl,
        },
        typeScrollerContent: {
          paddingHorizontal: spacing.xl,
          gap: spacing.sm,
        },
        typeChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: borderRadius.full,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
        },
        typeChipSel: {
          borderColor: colors.primary,
          backgroundColor: colors.primary,
        },
        typeChipDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
        },
        typeChipText: {
          color: colors.text,
          fontWeight: typography.semibold,
          fontSize: typography.sm,
        },
        typeChipTextSel: {
          color: colors.textOnPrimary,
        },
        scheduleGrid: {
          gap: spacing.sm,
        },
        scheduleRow: {
          minHeight: 60,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
        },
        scheduleIcon: {
          width: 34,
          height: 34,
          borderRadius: borderRadius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
        },
        scheduleText: {
          flex: 1,
        },
        scheduleLabel: {
          fontSize: typography.xs,
          color: colors.textSecondary,
          marginBottom: 3,
        },
        scheduleValue: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.text,
        },
        durationBox: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.md,
          marginTop: spacing.sm,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surfaceMuted,
        },
        durationText: {
          fontSize: typography.sm,
          fontWeight: typography.semibold,
          color: colors.textSecondary,
        },
        validationText: {
          marginTop: spacing.sm,
          fontSize: typography.sm,
          fontWeight: typography.semibold,
          color: colors.error,
        },
        optionRow: {
          minHeight: 64,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
          marginBottom: spacing.sm,
        },
        optionRowMuted: {
          opacity: 0.58,
        },
        optionText: {
          flex: 1,
        },
        optionTitle: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.text,
        },
        optionTitleMuted: {
          color: colors.textSecondary,
        },
        optionSubtitle: {
          marginTop: 2,
          fontSize: typography.xs,
          color: colors.textSecondary,
        },
        optionSubtitleMuted: {
          color: colors.textTertiary,
        },
        optionHelper: {
          marginTop: 6,
          fontSize: typography.xs,
          fontWeight: typography.semibold,
          color: colors.primary,
        },
        footer: {
          flexDirection: "row",
          gap: spacing.sm,
          padding: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        cancelBtn: {
          flex: 1,
          minHeight: 48,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceMuted,
        },
        saveBtn: {
          flex: 1.45,
          minHeight: 48,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        disabled: {
          opacity: 0.55,
        },
        buttonText: {
          fontSize: typography.base,
          fontWeight: typography.bold,
        },
        cancelText: {
          color: colors.textSecondary,
        },
        saveText: {
          color: colors.textOnPrimary,
        },
      }),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const pickerMode = pickerTarget?.endsWith("Time") ? "time" : "date";
  const pickerValue = pickerTarget?.startsWith("start")
    ? startDateTime
    : endDateTime;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.overlay}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <View style={s.sheet}>
          <View style={s.header}>
            <View style={s.headerText}>
              <Text style={s.title}>
                {event ? "Modifier l'événement" : "Nouvel événement"}
              </Text>
              <Text style={s.subtitle}>
                {event
                  ? "Mettez à jour les informations"
                  : "Planifiez un événement interne"}
              </Text>
            </View>

            <TouchableOpacity style={s.closeBtn} onPress={onClose} disabled={saving}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.section}>
              <Text style={s.sectionTitle}>Informations</Text>

              <Text style={s.label}>Titre</Text>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="Titre de l'événement"
                editable={!saving}
              />

              <Text style={s.label}>Description</Text>
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Description optionnelle"
                multiline
                editable={!saving}
              />

              <Text style={s.label}>Type</Text>
              <ScrollView
                horizontal
                style={s.typeScroller}
                contentContainerStyle={s.typeScrollerContent}
                showsHorizontalScrollIndicator={false}
              >
                {EVENT_TYPES.map((opt) => {
                  const selected = type === opt.value;

                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.typeChip, selected && s.typeChipSel]}
                      onPress={() => setType(opt.value)}
                      disabled={saving}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          s.typeChipDot,
                          {
                            backgroundColor: selected
                              ? colors.textOnPrimary
                              : opt.color,
                          },
                        ]}
                      />
                      <Text
                        style={[s.typeChipText, selected && s.typeChipTextSel]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Date et heure</Text>

              <View style={s.scheduleGrid}>
                <SchedulePickerRow
                  label="Début date"
                  value={formatDateValue(startDateTime)}
                  icon="calendar-outline"
                  onPress={() => setPickerTarget("startDate")}
                  disabled={saving}
                  styles={s}
                  colors={colors}
                />
                <SchedulePickerRow
                  label="Début time"
                  value={formatTime(startDateTime)}
                  icon="time-outline"
                  onPress={() => setPickerTarget("startTime")}
                  disabled={saving}
                  styles={s}
                  colors={colors}
                />
                <SchedulePickerRow
                  label="Fin date"
                  value={formatDateValue(endDateTime)}
                  icon="calendar-clear-outline"
                  onPress={() => setPickerTarget("endDate")}
                  disabled={saving}
                  styles={s}
                  colors={colors}
                />
                <SchedulePickerRow
                  label="Fin time"
                  value={formatTime(endDateTime)}
                  icon="alarm-outline"
                  onPress={() => setPickerTarget("endTime")}
                  disabled={saving}
                  styles={s}
                  colors={colors}
                />
              </View>

              <View style={s.durationBox}>
                <Ionicons
                  name="hourglass-outline"
                  size={15}
                  color={validationMessage ? colors.error : colors.textSecondary}
                />
                <Text
                  style={[
                    s.durationText,
                    validationMessage && { color: colors.error },
                  ]}
                >
                  Durée : {formatDuration(startDateTime, endDateTime)}
                </Text>
              </View>

              {!!validationMessage && (
                <Text style={s.validationText}>{validationMessage}</Text>
              )}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Options</Text>
              <OptionSwitchRow
                title="Événement obligatoire"
                subtitle="Signaler que la présence est attendue"
                value={isMandatory}
                onValueChange={handleMandatoryChange}
                disabled={saving}
                styles={s}
                colors={colors}
              />
              <OptionSwitchRow
                title="Confirmation RSVP"
                subtitle="Permettre aux membres de confirmer"
                helperText={
                  isMandatory
                    ? "RSVP désactivé car l'événement est obligatoire"
                    : null
                }
                value={rsvpEnabled}
                onValueChange={setRsvpEnabled}
                disabled={saving || isMandatory}
                muted={isMandatory}
                styles={s}
                colors={colors}
              />
            </View>
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity
              style={[s.cancelBtn, saving && s.disabled]}
              onPress={onClose}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={[s.buttonText, s.cancelText]}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.saveBtn, (saving || !!validationMessage) && s.disabled]}
              onPress={handleSave}
              disabled={saving || !!validationMessage}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={[s.buttonText, s.saveText]}>
                  {event ? "Enregistrer" : "Créer l'événement"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {pickerTarget && (
        <DateTimePicker
          value={pickerValue}
          mode={pickerMode}
          display="default"
          minimumDate={
            pickerMode === "date"
              ? startOfDay(createTunisiaDateTimeCarrier())
              : undefined
          }
          onChange={(nativeEvent, selectedDate) => {
            if (nativeEvent.type === "dismissed" || !selectedDate) {
              setPickerTarget(null);
              return;
            }

            if (pickerMode === "date") updateDatePart(pickerTarget, selectedDate);
            else updateTimePart(pickerTarget, selectedDate);

            setPickerTarget(null);
          }}
        />
      )}
    </Modal>
  );
};

const EventManagementScreen = () => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const {
    canManageEvents,
    roleId,
    roleName,
    isAdmin,
    isManager,
  } = useRoles();
  const route = useRoute();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedActionEvent, setSelectedActionEvent] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rsvpModalEvent, setRsvpModalEvent] = useState(null);
  const [rsvpResponses, setRsvpResponses] = useState([]);
  const [loadingRsvps, setLoadingRsvps] = useState(false);
  const [rsvpResponsesError, setRsvpResponsesError] = useState("");
  const [feedback, setFeedback] = useState({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  const showFeedback = useCallback((type, title, message) => {
    setFeedback({
      visible: true,
      type,
      title,
      message,
    });
  }, []);

  const closeFeedback = useCallback(() => {
    setFeedback((prev) => ({ ...prev, visible: false }));
  }, []);

  React.useEffect(() => {
    if (route.params?.openCreateModal) {
      setEditEvent(null);
      setModalVisible(true);
    }
  }, [route.params?.openCreateModal]);

  const normalizeEvent = (event) => {
    const isMandatory = event?.isMandatory ?? event?.IsMandatory ?? false;

    return {
      id: event?.id ?? event?.Id,
      title: event?.title ?? event?.Title ?? "Événement",
      description: event?.description ?? event?.Description ?? "",
      type: normalizeEventType(event?.type ?? event?.Type ?? 7),
      startDateTime: event?.startDateTime ?? event?.StartDateTime,
      endDateTime: event?.endDateTime ?? event?.EndDateTime,
      isMandatory,
      rsvpEnabled: isMandatory
        ? false
        : event?.rsvpEnabled ?? event?.RsvpEnabled ?? event?.RSVPEnabled ?? true,
      goingCount: getEventCountValue(event, "goingCount", "GoingCount"),
      notGoingCount: getEventCountValue(event, "notGoingCount", "NotGoingCount"),
      maybeCount: getEventCountValue(event, "maybeCount", "MaybeCount"),
    };
  };

  const loadEvents = useCallback(async (isRefresh = false, options = {}) => {
    const { showError = true, clearOnError = true } = options;

    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const todayKey = formatTunisiaDateKey(new Date());

      const results = [];

      for (let i = 0; i < 30; i++) {
        const dateStr = addDaysToDateKey(todayKey, i);
        const res = await eventService.getEventsByDate(dateStr);

        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.data)
            ? res.data.data
            : [];

        results.push(...list);
      }

      const normalized = results
        .map(normalizeEvent)
        .filter((e) => e.id != null);

      const uniq = [];
      const seen = new Set();

      for (const e of normalized) {
        const key = String(e.id);
        if (seen.has(key)) continue;
        seen.add(key);
        uniq.push(e);
      }

      uniq.sort(
        (a, b) =>
          parseApiInstant(a.startDateTime).getTime() -
          parseApiInstant(b.startDateTime).getTime(),
      );

      setEvents(uniq);
      return true;
    } catch (e) {
      logger.debug("EVENT MANAGEMENT LOAD ERROR:", {
        message: e?.message,
        status: e?.status ?? e?.response?.status,
        data: e?.data ?? e?.response?.data,
        url: e?.url ?? e?.config?.url,
        baseURL: e?.baseURL ?? e?.config?.baseURL,
      });

      if (showError) {
        showFeedback(
          "error",
          "Erreur",
          e?.data?.message ||
            e?.response?.data?.message ||
            e?.data ||
            e?.response?.data ||
            e?.message ||
            "Chargement échoué",
        );
      }

      if (clearOnError) {
        setEvents([]);
      }

      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showFeedback]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents]),
  );

  const groupedEvents = useMemo(() => {
    const now = new Date();
    const upcomingByDate = new Map();
    const past = [];

    events.forEach((event) => {
      const end = event.endDateTime ? parseApiInstant(event.endDateTime) : null;
      const start = event.startDateTime
        ? parseApiInstant(event.startDateTime)
        : null;

      if (end && end < now) {
        past.push(event);
        return;
      }

      const key = start ? formatTunisiaDateKey(start) : formatTunisiaDateKey(now);
      const keyDate = parseDateKeyCarrier(key);

      if (!upcomingByDate.has(key)) {
        upcomingByDate.set(key, {
          key,
          title: formatSectionDate(keyDate),
          data: [],
        });
      }

      upcomingByDate.get(key).data.push(event);
    });

    const groups = Array.from(upcomingByDate.values()).sort(
      (a, b) =>
        parseDateKeyCarrier(a.key).getTime() -
        parseDateKeyCarrier(b.key).getTime(),
    );

    if (past.length > 0) {
      groups.push({
        key: "past",
        title: "ÉVÉNEMENTS PASSÉS",
        data: past.sort(
          (a, b) =>
            parseApiInstant(b.startDateTime).getTime() -
            parseApiInstant(a.startDateTime).getTime(),
        ),
      });
    }

    return groups;
  }, [events]);

  const upcomingCount = useMemo(
    () =>
      events.filter(
        (event) =>
          !event.endDateTime || parseApiInstant(event.endDateTime) >= new Date(),
      ).length,
    [events],
  );

  const handleSave = async (id, data, selectedEvent = null) => {
    try {
      if (id) {
        logger.debug("EVENT SAVE PUT START:", {
          selectedEvent,
          id,
          payload: data,
          startDateTime: data?.startDateTime,
          endDateTime: data?.endDateTime,
          currentUserRole: {
            roleId,
            roleName,
            isAdmin,
            isManager,
            canManageEvents,
          },
        });

        const res = await eventService.updateEvent(id, data);
        const updated = normalizeEvent(getResponsePayload(res));

        setEvents((prev) =>
          prev.map((e) => (String(e.id) === String(id) ? updated : e)),
        );
      } else {
        if (selectedEvent) {
          throw new Error("Impossible de modifier l'événement : identifiant manquant.");
        }

        const res = await eventService.createEvent(data);
        const created = normalizeEvent(getResponsePayload(res));

        setEvents((prev) => [created, ...prev]);
      }

      const refreshed = await loadEvents(true, {
        showError: false,
        clearOnError: false,
      });

      showFeedback(
        refreshed ? "success" : "warning",
        refreshed ? "Succès" : "Attention",
        id
          ? refreshed
            ? "Événement modifié"
            : "Événement modifié, mais rafraîchissement échoué"
          : refreshed
            ? "Événement créé"
            : "Événement créé, mais rafraîchissement échoué",
      );
    } catch (e) {
      logger.debug("EVENT SAVE ERROR:", {
        message: e?.message,
        status: e?.status ?? e?.response?.status,
        data: e?.data ?? e?.response?.data,
        url: e?.url ?? e?.config?.url,
        baseURL: e?.baseURL ?? e?.config?.baseURL,
      });

      throw e;
    }
  };

  const confirmDeleteEvent = async () => {
    const eventId = getEventId(deleteCandidate);
    if (eventId == null) {
      setDeleteCandidate(null);
      showFeedback("error", "Erreur", "Identifiant événement manquant");
      return;
    }

    setDeletingId(eventId);

    try {
      await eventService.deleteEvent(eventId);
      setEvents((prev) => prev.filter((e) => String(e.id) !== String(eventId)));
      setDeleteCandidate(null);
    } catch (e) {
      showFeedback("error", "Erreur", "Suppression échouée");
    } finally {
      setDeletingId(null);
    }
  };

  const openCreateModal = () => {
    setEditEvent(null);
    setModalVisible(true);
  };

  const openEditModal = (event) => {
    setSelectedActionEvent(null);
    setEditEvent(event);
    setModalVisible(true);
  };

  const openDeleteConfirm = (event) => {
    setSelectedActionEvent(null);
    setDeleteCandidate(event);
  };

  const openRsvpResponses = async (event) => {
    const eventId = getEventId(event);
    if (!isAdmin || eventId == null || !event?.rsvpEnabled) return;

    setSelectedActionEvent(null);
    setRsvpModalEvent(event);
    setRsvpResponses([]);
    setRsvpResponsesError("");
    setLoadingRsvps(true);

    try {
      const response = await eventService.getEventRsvps(eventId);
      setRsvpResponses(getResponseArray(response));
    } catch (e) {
      logger.debug("EVENT RSVP RESPONSES LOAD ERROR:", {
        eventId,
        message: e?.message,
        status: e?.status ?? e?.response?.status,
        data: e?.data ?? e?.response?.data,
        url: e?.url ?? e?.config?.url,
        baseURL: e?.baseURL ?? e?.config?.baseURL,
      });
      setRsvpResponsesError("Impossible de charger les réponses.");
    } finally {
      setLoadingRsvps(false);
    }
  };

  if (!canManageEvents) {
    return (
      <View style={styles.accessDenied}>
        <Text style={styles.accessDeniedText}>
          Accès réservé aux managers et admins.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Gestion des événements</Text>
          <Text style={styles.headerSubtitle}>
            Planifiez et gérez les événements internes
          </Text>

          <View style={styles.countPill}>
            <Ionicons name="calendar-outline" size={13} color={colors.primary} />
            <Text style={styles.countText}>
              {upcomingCount} événements à venir
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addCircle}
          onPress={openCreateModal}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadEvents(true)}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loader}
          />
        ) : events.length === 0 ? (
          <EmptyState
            iconName="calendar-outline"
            title="Aucun événement"
            subtitle="Créez le premier événement !"
          />
        ) : (
          groupedEvents.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {group.data.map((event) => (
                <EventAgendaCard
                  key={event.id}
                  event={event}
                  styles={styles}
                  colors={colors}
                  deleting={String(deletingId) === String(event.id)}
                  onOpenActions={setSelectedActionEvent}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <EditEventModal
        visible={modalVisible}
        event={editEvent}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        onFeedback={showFeedback}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
        shadows={shadows}
      />

      <EventActionSheet
        visible={!!selectedActionEvent}
        event={selectedActionEvent}
        onClose={() => setSelectedActionEvent(null)}
        onEdit={() => openEditModal(selectedActionEvent)}
        onDelete={() => openDeleteConfirm(selectedActionEvent)}
        onViewRsvps={() => openRsvpResponses(selectedActionEvent)}
        showRsvpAction={isAdmin && selectedActionEvent?.rsvpEnabled === true}
        deleting={String(deletingId) === String(getEventId(selectedActionEvent))}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
        shadows={shadows}
      />

      <RsvpResponsesModal
        visible={!!rsvpModalEvent}
        event={rsvpModalEvent}
        responses={rsvpResponses}
        loading={loadingRsvps}
        error={rsvpResponsesError}
        onClose={() => setRsvpModalEvent(null)}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
        shadows={shadows}
      />

      <ConfirmActionModal
        visible={!!deleteCandidate}
        title="Supprimer l'événement"
        message="Cette action supprimera définitivement cet événement."
        confirmLabel="Supprimer"
        destructive
        loading={String(deletingId) === String(getEventId(deleteCandidate))}
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={confirmDeleteEvent}
      />

      <FeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onConfirm={closeFeedback}
      />
    </View>
  );
};

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    accessDenied: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      backgroundColor: colors.background,
    },

    accessDeniedText: {
      color: colors.textSecondary,
      textAlign: "center",
      fontSize: typography.base,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.xl,
      gap: spacing.lg,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...shadows.sm,
    },

    headerText: {
      flex: 1,
    },

    headerTitle: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: colors.text,
    },

    headerSubtitle: {
      marginTop: 4,
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    countPill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },

    countText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
    },

    addCircle: {
      width: 46,
      height: 46,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      ...shadows.md,
    },

    list: {
      flex: 1,
    },

    listContent: {
      padding: spacing.lg,
      paddingBottom: 60,
    },

    loader: {
      marginTop: 40,
    },

    group: {
      marginBottom: spacing.xl,
    },

    groupTitle: {
      marginBottom: spacing.sm,
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.textTertiary,
      letterSpacing: 0,
    },

    agendaCard: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: spacing.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...shadows.sm,
    },

    agendaCardPast: {
      opacity: 0.58,
    },

    timeColumn: {
      width: 50,
      alignItems: "flex-end",
      paddingTop: 2,
    },

    startTime: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
    },

    endTime: {
      marginTop: 4,
      fontSize: typography.xs,
      color: colors.textSecondary,
    },

    typeAccent: {
      width: 3,
      borderRadius: borderRadius.full,
    },

    agendaMain: {
      flex: 1,
      minWidth: 0,
    },

    agendaTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    eventTitle: {
      flex: 1,
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
    },

    metaLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginTop: 6,
    },

    typeDot: {
      width: 16,
      height: 16,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
    },

    typeDotInner: {
      width: 7,
      height: 7,
      borderRadius: borderRadius.full,
    },

    typeLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
    },

    description: {
      marginTop: spacing.sm,
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 19,
    },

    badgesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },

    softBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },

    softBadgeText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
    },

    pastBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      backgroundColor: colors.warningLight,
      borderRadius: borderRadius.full,
    },

    pastText: {
      fontSize: typography.xs,
      color: colors.warning,
      fontWeight: typography.bold,
    },

    moreBtn: {
      width: 34,
      height: 34,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
  });

export default EventManagementScreen;
