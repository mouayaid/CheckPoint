import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Pressable,
  Platform,
  RefreshControl,
  LayoutAnimation,
  UIManager,
} from "react-native";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import roomService from "../services/api/roomService";
import { roomReservationService } from "../services/api/roomReservationService";
import { useTheme } from "../context/ThemeContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_DURATIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 h", minutes: 60 },
  { label: "2 h", minutes: 120 },
];

const MY_RESERVATION_FILTERS = ["All", "Upcoming", "Past"];

const MY_RESERVATION_FILTER_LABELS_FR = {
  All: "Tout",
  Upcoming: "À venir",
  Past: "Passées",
};

// ─── Date utilities ────────────────────────────────────────────────────────────

const formatDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseDateKey = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const startOfWeekMonday = (date) => {
  const cloned = new Date(date);
  const day = cloned.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  cloned.setDate(cloned.getDate() + diff);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
};

const getWorkWeekDays = (baseDate) => {
  const monday = startOfWeekMonday(baseDate);
  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
};

const sameDateKey = (a, b) => formatDateKey(a) === formatDateKey(b);

const formatTime = (dateObj) => {
  if (!dateObj) return "";
  const hh = String(dateObj.getHours()).padStart(2, "0");
  const mm = String(dateObj.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const formatRange = (isoStart, isoEnd) => {
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  return `${formatTime(s)} – ${formatTime(e)}`;
};

const formatReservationDate = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const startFormatted = s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const endFormatted = e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${startFormatted} – ${endFormatted}`;
};

const combineDateAndTime = (dateStr, timeDateObj) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const hh = timeDateObj.getHours();
  const mm = timeDateObj.getMinutes();
  return new Date(y, m - 1, d, hh, mm, 0, 0);
};

const findNextAvailableSlot = (reservations, dateStr, durationMinutes = 60) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const workStart = new Date(y, m - 1, d, 8, 0, 0, 0);
  const workEnd = new Date(y, m - 1, d, 18, 0, 0, 0);
  const sorted = [...reservations].sort(
    (a, b) =>
      new Date(a.startDateTime || a.startDate || a.start) -
      new Date(b.startDateTime || b.startDate || b.start)
  );
  let candidateStart = new Date(workStart);
  for (const r of sorted) {
    const existingStart = new Date(r.startDateTime || r.startDate || r.start);
    const existingEnd = new Date(r.endDateTime || r.endDate || r.end);
    const candidateEnd = new Date(candidateStart);
    candidateEnd.setMinutes(candidateEnd.getMinutes() + durationMinutes);
    if (candidateEnd <= existingStart) return { start: candidateStart, end: candidateEnd };
    if (candidateStart < existingEnd) candidateStart = new Date(existingEnd);
  }
  const finalEnd = new Date(candidateStart);
  finalEnd.setMinutes(finalEnd.getMinutes() + durationMinutes);
  if (finalEnd <= workEnd) return { start: candidateStart, end: finalEnd };
  return null;
};

const getDurationMinutes = (start, end) => {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
};

const formatDuration = (minutes) => {
  if (!minutes) return "0 min";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins} min`;
};

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  return error.message || error.data?.message || error.response?.data?.message || fallback;
}

function normalizeStatusKey(status) {
  if (typeof status === "number" && Number.isFinite(status)) {
    const map = { 0: "pending", 1: "active", 2: "inprogress", 3: "completed", 4: "cancelled", 5: "rejected" };
    return map[status] || String(status);
  }
  return String(status ?? "").toLowerCase();
}

// ─── StatusBadge — uses semantic color tokens from theme ──────────────────────

function StatusBadge({ status, colors }) {
  const key = normalizeStatusKey(status);

  const configs = {
    pending:    { label: "En attente", bg: colors.warningLight,  fg: colors.warning,       dot: colors.warning       },
    active:     { label: "Active",     bg: colors.successLight,  fg: colors.success,       dot: colors.success       },
    approved:   { label: "Active",     bg: colors.successLight,  fg: colors.success,       dot: colors.success       },
    inprogress: { label: "En cours",   bg: colors.infoLight,     fg: colors.info,          dot: colors.info          },
    completed:  { label: "Terminée",   bg: colors.surfaceMuted,  fg: colors.textSecondary, dot: colors.textTertiary  },
    rejected:   { label: "Rejetée",    bg: colors.errorLight,    fg: colors.error,         dot: colors.error         },
    cancelled:  { label: "Annulée",    bg: colors.surfaceMuted,  fg: colors.textSecondary, dot: colors.border        },
  };

  const config = configs[key] || {
    label: String(status ?? "—"),
    bg: colors.surfaceMuted,
    fg: colors.textSecondary,
    dot: colors.textTertiary,
  };

  return (
    <View style={[badgeStyles.badge, { backgroundColor: config.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: config.dot }]} />
      <Text style={[badgeStyles.text, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  text:  { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
});

// ─── Main Component ────────────────────────────────────────────────────────────

export default function RoomReservationScreen() {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows]
  );

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateKey(today), [today]);

  const [weekStartDate, setWeekStartDate] = useState(startOfWeekMonday(today));
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [purpose, setPurpose] = useState("");

  const [dayReservations, setDayReservations] = useState([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [myReservations, setMyReservations] = useState([]);
  const [loadingMyReservations, setLoadingMyReservations] = useState(false);

  const [roomDayStatusMap, setRoomDayStatusMap] = useState({});
  const [loadingRoomStatuses, setLoadingRoomStatuses] = useState(false);
  const [roomDayLoadError, setRoomDayLoadError] = useState(null);
  const [modalScheduleError, setModalScheduleError] = useState(null);

  const [refreshing, setRefreshing] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [reservationFilter, setReservationFilter] = useState("All");

  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanningResId, setScanningResId] = useState(null);
  const [scanningAction, setScanningAction] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const workDays = useMemo(() => getWorkWeekDays(weekStartDate), [weekStartDate]);

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { if (rooms.length > 0) loadRoomStatusesForSelectedDate(); }, [rooms, selectedDate]);
  useEffect(() => { if (modalVisible && selectedRoom?.id) loadReservationsForSelected(); }, [selectedDate, modalVisible, selectedRoom]);
  useEffect(() => { if (!scannerVisible) setScanning(false); }, [scannerVisible]);

  const loadInitialData = async () => {
    await Promise.all([loadRooms(), loadMyReservations()]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadRooms(),
        loadMyReservations(),
        rooms.length > 0 ? loadRoomStatusesForSelectedDate() : Promise.resolve(),
      ]);
      if (modalVisible && selectedRoom?.id) await loadReservationsForSelected();
    } finally { setRefreshing(false); }
  };

  const loadRooms = async () => {
    try {
      const response = await roomService.getAllRooms();
      if (response?.success) setRooms(response.data || []);
      else Alert.alert("Impossible de charger les salles", response?.message || "Actualiser et réessayer.");
    } catch (error) {
      Alert.alert("Impossible de charger les salles", getErrorMessage(error, "Vérifiez votre connexion."));
    }
  };

  const loadMyReservations = async () => {
    setLoadingMyReservations(true);
    try {
      const response = await roomService.getMyReservations();
      setMyReservations(response?.success ? response.data || [] : []);
    } catch { setMyReservations([]); }
    finally { setLoadingMyReservations(false); }
  };

  const ensureCameraPermission = async () => {
    if (cameraPermission?.granted) return true;
    const result = await requestCameraPermission();
    if (!result?.granted) Alert.alert("Permission refusée", "Accès caméra nécessaire pour scanner le QR.");
    return result?.granted ?? false;
  };

  const handleScanPress = async (resId, action) => {
    setScanningResId(resId); setScanningAction(action);
    const granted = await ensureCameraPermission();
    if (granted) setScannerVisible(true);
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanning) return;
    setScanning(true);
    const match = data.match(/^room:(\d+)$/);
    if (!match) { Alert.alert("QR invalide", "Scanner le QR permanent de la salle."); setScanning(false); return; }
    const roomId = parseInt(match[1], 10);
    try {
      if (scanningAction === "start") {
        await roomReservationService.scanStart(scanningResId, roomId);
        Alert.alert("Réunion démarrée", "Réunion démarrée avec succès.");
      } else {
        await roomReservationService.scanFinish(scanningResId, roomId);
        Alert.alert("Réunion terminée", "Réunion terminée avec succès.");
      }
      setScannerVisible(false);
      await loadMyReservations();
      await loadRoomStatusesForSelectedDate();
    } catch (error) {
      Alert.alert("Erreur", getErrorMessage(error, "Action impossible."));
    } finally { setScanning(false); }
  };

  const fetchReservationsForRoomAndDate = async (roomId, date) => {
    try {
      const res = await roomService.getReservationsForDay(roomId, date);
      if (res?.success) return { ok: true, data: res.data || [], message: null };
      return { ok: false, data: [], message: res?.message || "Impossible de charger les réservations." };
    } catch (error) {
      return { ok: false, data: [], message: getErrorMessage(error, "Impossible de charger les réservations.") };
    }
  };

  const loadRoomStatusesForSelectedDate = async () => {
    setLoadingRoomStatuses(true); setRoomDayLoadError(null);
    try {
      if (rooms.length === 0) { setRoomDayStatusMap({}); return; }
      const results = await Promise.all(
        rooms.map(async (room) => {
          const out = await fetchReservationsForRoomAndDate(room.id, selectedDate);
          return { roomId: room.id, ...out };
        })
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        setRoomDayLoadError(failed.message || "Impossible de charger les disponibilités.");
        setRoomDayStatusMap({});
        return;
      }
      const map = {};
      results.forEach((item) => { map[item.roomId] = item.data; });
      setRoomDayStatusMap(map);
    } finally { setLoadingRoomStatuses(false); }
  };

  const loadReservationsForSelected = async () => {
    if (!selectedRoom?.id) return;
    setLoadingReservations(true); setModalScheduleError(null);
    try {
      const { ok, data: reservations, message } = await fetchReservationsForRoomAndDate(selectedRoom.id, selectedDate);
      if (!ok) { setDayReservations([]); setModalScheduleError(message || "Impossible de charger le planning."); return; }
      setDayReservations(reservations);
      const suggestion = findNextAvailableSlot(reservations, selectedDate, 60);
      if (suggestion) { setStartTime(suggestion.start); setEndTime(suggestion.end); }
    } catch (error) {
      setDayReservations([]); setModalScheduleError(getErrorMessage(error, "Impossible de charger le planning."));
    } finally { setLoadingReservations(false); }
  };

  const resetModal = () => {
    setStartTime(null); setEndTime(null); setPurpose(""); setDayReservations([]);
    setLoadingReservations(false); setModalScheduleError(null); setSelectedRoom(null);
    setModalVisible(false); setShowStartPicker(false); setShowEndPicker(false); setReserving(false);
  };

  const hasOverlap = (newStart, newEnd) =>
    dayReservations.some((r) => {
      const existingStart = new Date(r.startDateTime || r.startDate || r.start);
      const existingEnd = new Date(r.endDateTime || r.endDate || r.end);
      return newStart < existingEnd && newEnd > existingStart;
    });

  const handleOpenModal = async (room) => {
    setSelectedRoom(room); setModalVisible(true); setModalScheduleError(null);
    const selected = parseDateKey(selectedDate);
    setStartTime(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 9, 0));
    setEndTime(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 10, 0));
    setLoadingReservations(true);
    try {
      const { ok, data: reservations, message } = await fetchReservationsForRoomAndDate(room.id, selectedDate);
      if (!ok) { setDayReservations([]); setModalScheduleError(message || "Impossible de charger le planning."); return; }
      setDayReservations(reservations);
      const suggestion = findNextAvailableSlot(reservations, selectedDate, 60);
      if (suggestion) { setStartTime(suggestion.start); setEndTime(suggestion.end); }
    } catch (error) {
      setDayReservations([]); setModalScheduleError(getErrorMessage(error, "Impossible de charger le planning."));
    } finally { setLoadingReservations(false); }
  };

  const applyQuickDuration = (minutes) => {
    if (!startTime) return;
    const nextEnd = new Date(startTime);
    nextEnd.setMinutes(nextEnd.getMinutes() + minutes);
    setEndTime(nextEnd);
  };

  const handleReserve = async () => {
    if (!selectedRoom?.id) { Alert.alert("Aucune salle", "Choisissez d'abord une salle."); return; }
    if (!startTime || !endTime) { Alert.alert("Plage horaire requise", "Sélectionnez une heure de début et de fin."); return; }
    if (!purpose.trim()) { Alert.alert("Objet requis", "Décrivez brièvement la réunion."); return; }
    const startDateTime = combineDateAndTime(selectedDate, startTime);
    const endDateTime = combineDateAndTime(selectedDate, endTime);
    if (endDateTime <= startDateTime) { Alert.alert("Plage invalide", "L'heure de fin doit être après le début."); return; }
    if (hasOverlap(startDateTime, endDateTime)) { Alert.alert("Conflit horaire", "Ce créneau chevauche une réservation existante."); return; }
    setReserving(true);
    try {
      const payload = {
        roomId: Number(selectedRoom.id),
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        purpose: purpose.trim(),
      };
      const response = await roomService.createReservation(payload);
      if (response?.success) {
        Alert.alert("Réservation créée", response.message || "Votre réservation a été créée.", [{ text: "OK" }]);
        await Promise.all([loadReservationsForSelected(), loadMyReservations(), loadRoomStatusesForSelectedDate()]);
        resetModal();
      } else {
        Alert.alert("Échec", response?.message || "Une erreur s'est produite.");
      }
    } catch (error) {
      const status = error?.status || error?.response?.status;
      const msg = getErrorMessage(error, "Impossible de créer la réservation.");
      if (status === 409) Alert.alert("Créneau indisponible", msg);
      else if (status === 400) Alert.alert("Demande invalide", msg);
      else Alert.alert("Échec", msg);
    } finally { setReserving(false); }
  };

  // Returns availability info using only theme color tokens
  const getRoomAvailability = (roomId) => {
    const reservations = roomDayStatusMap[roomId] || [];
    if (loadingRoomStatuses) return { label: "Vérification…", color: colors.textTertiary };
    if (roomDayLoadError)    return { label: "Aucune donnée",  color: colors.textTertiary };
    if (reservations.length === 0) return { label: "Libre", color: colors.success };
    if (selectedDate === todayStr) {
      const now = new Date();
      const busyNow = reservations.some((r) => {
        const start = new Date(r.startDateTime || r.startDate || r.start);
        const end   = new Date(r.endDateTime   || r.endDate   || r.end);
        return now >= start && now <= end;
      });
      if (busyNow) return { label: "Occupée", color: colors.error };
    }
    return {
      label: `${reservations.length} créneau${reservations.length > 1 ? "x" : ""}`,
      color: colors.warning,
    };
  };

  const selectedDateReadable = useMemo(() =>
    parseDateKey(selectedDate).toLocaleDateString("fr-FR", {
      weekday: "long", month: "long", day: "numeric",
    }),
    [selectedDate]
  );

  const selectedDayRoomSummary = useMemo(() => {
    if (roomDayLoadError) return null;
    let freeAllDay = 0, partial = 0;
    rooms.forEach((room) => {
      const reservations = roomDayStatusMap[room.id] || [];
      if (reservations.length === 0) freeAllDay += 1; else partial += 1;
    });
    return { freeAllDay, partial };
  }, [rooms, roomDayStatusMap, roomDayLoadError]);

  const filteredMyReservations = useMemo(() => {
    const now = new Date();
    const sorted = [...myReservations].sort(
      (a, b) =>
        new Date(b.startDateTime || b.startDate || b.start) -
        new Date(a.startDateTime || a.startDate || a.start)
    );
    if (reservationFilter === "Upcoming") return sorted.filter((r) => new Date(r.endDateTime || r.endDate || r.end) >= now);
    if (reservationFilter === "Past")     return sorted.filter((r) => new Date(r.endDateTime || r.endDate || r.end) <  now);
    return sorted;
  }, [myReservations, reservationFilter]);

  const durationMinutes = startTime && endTime
    ? getDurationMinutes(combineDateAndTime(selectedDate, startTime), combineDateAndTime(selectedDate, endTime))
    : 0;
  const overlapWarning = startTime && endTime
    ? hasOverlap(combineDateAndTime(selectedDate, startTime), combineDateAndTime(selectedDate, endTime))
    : false;
  const combinedStart = startTime && selectedDate ? combineDateAndTime(selectedDate, startTime) : null;
  const combinedEnd   = endTime   && selectedDate ? combineDateAndTime(selectedDate, endTime)   : null;
  const canSubmitRequest =
    !!selectedRoom?.id && !!startTime && !!endTime &&
    purpose.trim().length > 0 && !overlapWarning &&
    !!combinedStart && !!combinedEnd && combinedEnd > combinedStart && !modalScheduleError;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Salles</Text>
          <Text style={styles.headerSub}>Réservation & gestion</Text>
        </View>
        <View style={styles.headerAccentDot} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >

        {/* ── QR Scanner Modal ── */}
        {scannerVisible && (
          <Modal visible={scannerVisible} animationType="slide" transparent={false}>
            <View style={styles.scannerShell}>
              <View style={styles.scannerTopBar}>
                <TouchableOpacity onPress={() => setScannerVisible(false)} style={styles.scannerClose}>
                  <Ionicons name="close" size={20} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.scannerLabel}>
                  {scanningAction === "finish" ? "Terminer la réunion" : "Démarrer la réunion"}
                </Text>
                <View style={{ width: 36 }} />
              </View>

              {cameraPermission?.granted ? (
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={scanning ? undefined : handleBarCodeScanned}
                />
              ) : (
                <View style={styles.scannerPermBox}>
                  <Ionicons name="camera-outline" size={48} color={colors.textTertiary} />
                  <Text style={styles.scannerPermText}>Autorisation caméra requise</Text>
                  <TouchableOpacity style={styles.primaryBtn} onPress={ensureCameraPermission}>
                    <Text style={styles.primaryBtnText}>Autoriser</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.scannerBottom}>
                <View style={styles.scannerFrame} />
                <Text style={styles.scannerHint}>Pointez sur le QR permanent de la salle</Text>
              </View>
            </View>
          </Modal>
        )}

        {/* ══ Calendar Card ══ */}
        <View style={styles.card}>
          <View style={styles.weekNav}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => {
                const prev = new Date(weekStartDate); prev.setDate(prev.getDate() - 7);
                setWeekStartDate(prev); setSelectedDate(formatDateKey(getWorkWeekDays(prev)[0]));
              }}
            >
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.weekRange}>
              {workDays[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              {" – "}
              {workDays[4].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </Text>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => {
                const next = new Date(weekStartDate); next.setDate(next.getDate() + 7);
                setWeekStartDate(next); setSelectedDate(formatDateKey(getWorkWeekDays(next)[0]));
              }}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.dayRow}>
            {workDays.map((day) => {
              const isSelected = selectedDate === formatDateKey(day);
              const isToday = sameDateKey(day, today);
              return (
                <TouchableOpacity
                  key={formatDateKey(day)}
                  style={[styles.dayPill, isSelected && styles.dayPillSelected]}
                  onPress={() => setSelectedDate(formatDateKey(day))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayPillWeekday, isSelected && styles.dayPillWeekdaySelected]}>
                    {day.toLocaleDateString("fr-FR", { weekday: "narrow" })}
                  </Text>
                  <Text style={[styles.dayPillNum, isSelected && styles.dayPillNumSelected]}>
                    {day.getDate()}
                  </Text>
                  {isToday && (
                    <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {roomDayLoadError ? (
            <View style={styles.alertStrip}>
              <Ionicons name="warning-outline" size={15} color={colors.warning} />
              <Text style={styles.alertStripText}>Disponibilités indisponibles — actualisez.</Text>
            </View>
          ) : (
            <View style={styles.summaryStrip}>
              <Text style={styles.summaryDate}>{selectedDateReadable}</Text>
              {selectedDayRoomSummary && (
                <View style={styles.summaryPills}>
                  <View style={[styles.countPill, { backgroundColor: colors.successLight }]}>
                    <View style={[styles.countDot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.countPillText, { color: colors.success }]}>
                      {selectedDayRoomSummary.freeAllDay} libres
                    </Text>
                  </View>
                  <View style={[styles.countPill, { backgroundColor: colors.warningLight }]}>
                    <View style={[styles.countDot, { backgroundColor: colors.warning }]} />
                    <Text style={[styles.countPillText, { color: colors.warning }]}>
                      {selectedDayRoomSummary.partial} réservées
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ══ My Reservations ══ */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionHeading}>Mes réservations</Text>
            <Text style={styles.sectionCaption}>Scannez le QR pour démarrer / terminer</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {MY_RESERVATION_FILTERS.map((filter) => {
              const active = reservationFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setReservationFilter(filter);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {MY_RESERVATION_FILTER_LABELS_FR[filter] ?? filter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loadingMyReservations ? (
            <Text style={styles.mutedText}>Chargement…</Text>
          ) : filteredMyReservations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color={colors.border} />
              <Text style={styles.emptyStateTitle}>Aucune réservation</Text>
              <Text style={styles.emptyStateText}>
                Sélectionnez une salle ci-dessous pour créer une demande.
              </Text>
            </View>
          ) : (
            filteredMyReservations.map((reservation) => {
              const key = normalizeStatusKey(reservation.status ?? reservation.Status);
              const isStarted = !!(reservation.startedAt || reservation.StartedAt);
              const canStart  = key === "active" && !isStarted;
              const canFinish = (key === "inprogress" || isStarted) && key !== "completed" && key !== "cancelled";

              const accentColor =
                key === "active"     ? colors.success :
                key === "inprogress" ? colors.info :
                key === "pending"    ? colors.warning :
                key === "rejected"   ? colors.error : colors.border;

              return (
                <View key={reservation.id} style={styles.resCard}>
                  <View style={[styles.resCardAccent, { backgroundColor: accentColor }]} />
                  <View style={styles.resCardBody}>
                    <View style={styles.resCardHeader}>
                      <Text style={styles.resCardRoom}>{reservation.roomName || "Salle"}</Text>
                      <StatusBadge status={reservation.status ?? reservation.Status} colors={colors} />
                    </View>
                    <Text style={styles.resCardDate}>
                      {formatReservationDate(reservation.startDateTime, reservation.endDateTime)}
                    </Text>
                    {!!reservation.purpose && (
                      <View style={styles.purposeRow}>
                        <Ionicons name="chatbox-ellipses-outline" size={13} color={colors.textTertiary} />
                        <Text style={styles.purposeText} numberOfLines={2}>{reservation.purpose}</Text>
                      </View>
                    )}
                    {!!reservation.managerComment && (
                      <View style={styles.commentRow}>
                        <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
                        <Text style={styles.commentText}>{reservation.managerComment}</Text>
                      </View>
                    )}
                    {(canStart || canFinish) && (
                      <View style={styles.resCardActions}>
                        {canStart && (
                          <TouchableOpacity style={styles.scanBtn} onPress={() => handleScanPress(reservation.id, "start")}>
                            <Ionicons name="qr-code-outline" size={15} color={colors.textOnPrimary} />
                            <Text style={styles.scanBtnText}>Démarrer</Text>
                          </TouchableOpacity>
                        )}
                        {canFinish && (
                          <TouchableOpacity style={[styles.scanBtn, styles.scanBtnFinish]} onPress={() => handleScanPress(reservation.id, "finish")}>
                            <Ionicons name="qr-code-outline" size={15} color={colors.info} />
                            <Text style={[styles.scanBtnText, { color: colors.info }]}>Terminer</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ══ Rooms list ══ */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionHeading}>Salles disponibles</Text>
            <Text style={styles.sectionCaption}>Appuyez pour réserver</Text>
          </View>

          {rooms.map((room) => {
            const avail = getRoomAvailability(room.id);
            const reservationCount = (roomDayStatusMap[room.id] || []).length;
            const busyPercent = Math.min(100, (reservationCount / 10) * 100);

            return (
              <TouchableOpacity
                key={room.id}
                style={styles.roomCard}
                onPress={() => handleOpenModal(room)}
                activeOpacity={0.88}
              >
                <View style={[styles.roomAccent, { backgroundColor: avail.color }]} />
                <View style={styles.roomBody}>
                  <View style={styles.roomTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roomName}>{room.name}</Text>
                      <Text style={styles.roomMeta}>Étage {room.floor} · {room.capacity} pers.</Text>
                    </View>
                    <View style={[styles.availBadge, { backgroundColor: avail.color + "22" }]}>
                      <View style={[styles.availDot, { backgroundColor: avail.color }]} />
                      <Text style={[styles.availBadgeText, { color: avail.color }]}>{avail.label}</Text>
                    </View>
                  </View>

                  <View style={styles.barWrap}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${busyPercent}%`, backgroundColor: avail.color }]} />
                    </View>
                    <Text style={styles.barLabel}>
                      {reservationCount} créneau{reservationCount !== 1 ? "x" : ""} confirmé{reservationCount !== 1 ? "s" : ""}
                    </Text>
                  </View>

                  <View style={styles.featRow}>
                    {room.hasProjector && (
                      <View style={styles.feat}>
                        <Ionicons name="videocam-outline" size={12} color={colors.primary} />
                        <Text style={styles.featText}>Projecteur</Text>
                      </View>
                    )}
                    {room.hasWhiteboard && (
                      <View style={styles.feat}>
                        <Ionicons name="clipboard-outline" size={12} color={colors.primary} />
                        <Text style={styles.featText}>Tableau blanc</Text>
                      </View>
                    )}
                    {!room.hasProjector && !room.hasWhiteboard && (
                      <Text style={styles.featNone}>Pas d'équipement supplémentaire</Text>
                    )}
                    <View style={{ flex: 1 }} />
                    <Ionicons name="chevron-forward" size={15} color={colors.border} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* ══ Reservation Modal ══ */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={resetModal}>
        <Pressable style={styles.modalBackdrop} onPress={resetModal} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={styles.modalRoom}>{selectedRoom?.name}</Text>
                <Text style={styles.modalDate}>{selectedDateReadable}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={resetModal}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalDivider} />

            {modalScheduleError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.errorBannerText}>{modalScheduleError}</Text>
              </View>
            )}

            <Text style={styles.modalSectionLabel}>Créneaux confirmés</Text>

            {loadingReservations ? (
              <Text style={styles.mutedText}>Chargement du planning…</Text>
            ) : dayReservations.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyInlineText}>Aucun créneau pour cette journée</Text>
              </View>
            ) : (
              <View style={styles.timelineWrap}>
                {[...dayReservations]
                  .sort((a, b) =>
                    new Date(a.startDateTime || a.startDate || a.start) -
                    new Date(b.startDateTime || b.startDate || b.start)
                  )
                  .map((r, i) => {
                    const who = r.reservedBy?.fullName || r.reservedBy?.FullName || r.reservedBy?.userName;
                    return (
                      <View key={r.id} style={styles.timelineItem}>
                        <View style={styles.timelineLeft}>
                          <View style={styles.timelineDot} />
                          {i < dayReservations.length - 1 && <View style={styles.timelineLine} />}
                        </View>
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineTime}>
                            {formatRange(
                              r.startDateTime || r.startDate || r.start,
                              r.endDateTime   || r.endDate   || r.end
                            )}
                          </Text>
                          {!!who && <Text style={styles.timelineWho} numberOfLines={1}>{who}</Text>}
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}

            <Text style={[styles.modalSectionLabel, { marginTop: spacing.xxl }]}>Votre créneau</Text>

            <View style={styles.timePickers}>
              <Pressable style={styles.timePicker} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.timePickerLabel}>Début</Text>
                <Text style={styles.timePickerValue}>{startTime ? formatTime(startTime) : "--:--"}</Text>
              </Pressable>
              <View style={styles.timePickerSep}>
                <Ionicons name="arrow-forward" size={16} color={colors.border} />
              </View>
              <Pressable style={styles.timePicker} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.timePickerLabel}>Fin</Text>
                <Text style={styles.timePickerValue}>{endTime ? formatTime(endTime) : "--:--"}</Text>
              </Pressable>
            </View>

            {startTime && endTime && (
              <View style={styles.durationBar}>
                <Ionicons name="time-outline" size={14} color={colors.primary} />
                <Text style={styles.durationText}>{formatDuration(durationMinutes)}</Text>
                {overlapWarning && (
                  <>
                    <View style={styles.durationSep} />
                    <Ionicons name="warning-outline" size={14} color={colors.error} />
                    <Text style={styles.durationConflict}>Conflit détecté</Text>
                  </>
                )}
              </View>
            )}

            <View style={styles.quickRow}>
              {QUICK_DURATIONS.map((item) => (
                <TouchableOpacity
                  key={item.minutes}
                  style={styles.quickChip}
                  onPress={() => applyQuickDuration(item.minutes)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickChipText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startTime || new Date()}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, date) => {
                  setShowStartPicker(false);
                  if (event.type === "dismissed") return;
                  setStartTime(date);
                  if (date && endTime) {
                    const s = combineDateAndTime(selectedDate, date);
                    const e = combineDateAndTime(selectedDate, endTime);
                    if (e <= s) { const ne = new Date(date); ne.setMinutes(ne.getMinutes() + 30); setEndTime(ne); }
                  }
                }}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endTime || startTime || new Date()}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, date) => {
                  setShowEndPicker(false);
                  if (event.type !== "dismissed") setEndTime(date);
                }}
              />
            )}

            <Text style={[styles.modalSectionLabel, { marginTop: spacing.xl }]}>
              Objet <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={styles.purposeInput}
              placeholder="Ex. : Planification sprint avec l'équipe Design"
              placeholderTextColor={colors.placeholder}
              value={purpose}
              onChangeText={setPurpose}
              multiline
            />

            {overlapWarning && (
              <View style={styles.conflictCard}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.conflictTitle}>Conflit horaire</Text>
                  <Text style={styles.conflictText}>
                    Ajustez le créneau pour éviter les réservations existantes.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetModal} disabled={reserving}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!canSubmitRequest || reserving) && styles.submitBtnDisabled]}
                onPress={handleReserve}
                disabled={!canSubmitRequest || reserving}
                activeOpacity={0.88}
              >
                {!reserving && (
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.textOnPrimary} />
                )}
                <Text style={styles.submitBtnText}>{reserving ? "Envoi…" : "Confirmer"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footerTip}>
              Si le créneau a été pris entre-temps, actualisez et choisissez une autre plage.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles — zero hardcoded colors, 100% theme tokens ───────────────────────

const createStyles = (colors, spacing, borderRadius, typography, shadows) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: spacing.xl + 8,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: colors.text,
      letterSpacing: -0.5,
    },
    headerSub: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: typography.medium,
    },
    headerAccentDot: {
      width: 10,
      height: 10,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
    },

    scrollContent: { paddingBottom: spacing.xxxl + 16 },

    // Calendar card
    card: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    weekNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    navBtn: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    weekRange: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
    },

    // Day pills
    dayRow: { flexDirection: "row", gap: spacing.xs },
    dayPill: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      position: "relative",
    },
    dayPillSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayPillWeekday: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
      marginBottom: 3,
    },
    dayPillWeekdaySelected: { color: colors.primaryLight },
    dayPillNum: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.text },
    dayPillNumSelected: { color: colors.textOnPrimary },
    todayDot: {
      position: "absolute",
      bottom: 5,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.success,
    },
    todayDotSelected: { backgroundColor: colors.primaryLight },

    // Summary strip
    summaryStrip: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    summaryDate: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.sm,
      textTransform: "capitalize",
    },
    summaryPills: { flexDirection: "row", gap: spacing.sm },
    countPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    countDot: { width: 6, height: 6, borderRadius: 3 },
    countPillText: { fontSize: typography.xs, fontWeight: typography.bold },

    alertStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: spacing.sm + 2,
      backgroundColor: colors.warningLight,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    alertStripText: {
      fontSize: typography.sm,
      color: colors.text,
      fontWeight: typography.medium,
      flex: 1,
    },

    // Sections
    section: { paddingHorizontal: spacing.lg, marginTop: spacing.xxl },
    sectionTitleRow: { marginBottom: spacing.md },
    sectionHeading: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      letterSpacing: -0.3,
    },
    sectionCaption: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 3,
      fontWeight: typography.medium,
    },

    // Filter tabs
    tabRow: { gap: spacing.sm, paddingBottom: spacing.md },
    tab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 1,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textSecondary },
    tabTextActive: { color: colors.textOnPrimary },

    // Empty state
    emptyState: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
    emptyStateTitle: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textSecondary },
    emptyStateText: { fontSize: typography.sm, color: colors.textTertiary, textAlign: "center", maxWidth: 240 },

    // Reservation cards
    resCard: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.md,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    resCardAccent: { width: 4 },
    resCardBody: { flex: 1, padding: spacing.md },
    resCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: spacing.xs,
    },
    resCardRoom: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
      flex: 1,
      marginRight: spacing.sm,
    },
    resCardDate: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      fontWeight: typography.medium,
      marginBottom: spacing.sm,
    },
    purposeRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs + 2, marginBottom: spacing.xs },
    purposeText: { fontSize: typography.xs, color: colors.textSecondary, flex: 1, lineHeight: 17 },
    commentRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.xs + 2,
      backgroundColor: colors.warningLight,
      padding: spacing.sm + 2,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.warning,
      marginTop: spacing.sm,
    },
    commentText: { fontSize: typography.xs, color: colors.text, flex: 1, lineHeight: 17 },
    resCardActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    scanBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs + 2,
      paddingVertical: spacing.sm + 1,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
    },
    scanBtnFinish: {
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.info,
    },
    scanBtnText: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.textOnPrimary },

    // Room cards
    roomCard: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.md,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    roomAccent: { width: 5 },
    roomBody: { flex: 1, padding: spacing.md },
    roomTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    roomName: { fontSize: typography.base, fontWeight: typography.bold, color: colors.text },
    roomMeta: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 3, fontWeight: typography.medium },
    availBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    availDot: { width: 6, height: 6, borderRadius: 3 },
    availBadgeText: { fontSize: typography.xs, fontWeight: typography.bold },
    barWrap: { marginBottom: spacing.sm },
    barTrack: {
      height: 3,
      backgroundColor: colors.borderLight,
      borderRadius: 2,
      overflow: "hidden",
      marginBottom: spacing.xs,
    },
    barFill: { height: "100%", borderRadius: 2 },
    barLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: typography.medium },
    featRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs },
    feat: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs - 2,
      backgroundColor: colors.infoLight,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs - 1,
      borderRadius: borderRadius.sm,
    },
    featText: { fontSize: 11, color: colors.primary, fontWeight: typography.semibold },
    featNone: { fontSize: 11, color: colors.textTertiary, fontWeight: typography.medium },

    mutedText: { fontSize: typography.sm, color: colors.textTertiary, fontStyle: "italic" },

    // Modal
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
    modalSheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: "93%",
      ...shadows.lg,
    },
    modalHandle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: borderRadius.full,
      backgroundColor: colors.border,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    modalBody: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxxl,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
    },
    modalRoom: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
      letterSpacing: -0.4,
    },
    modalDate: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginTop: 3,
      fontWeight: typography.medium,
      textTransform: "capitalize",
    },
    modalCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    modalDivider: { height: 1, backgroundColor: colors.borderLight, marginBottom: spacing.lg },
    modalSectionLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.textTertiary,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
    },

    errorBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      backgroundColor: colors.errorLight,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.error,
      marginBottom: spacing.md,
    },
    errorBannerText: { fontSize: typography.sm, color: colors.error, flex: 1, lineHeight: 18 },

    emptyInline: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    emptyInlineText: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium },

    // Timeline
    timelineWrap: { gap: 0 },
    timelineItem: { flexDirection: "row", gap: spacing.md },
    timelineLeft: { width: 16, alignItems: "center" },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 2,
      borderColor: colors.border,
      marginTop: 2,
    },
    timelineLine: { width: 2, flex: 1, backgroundColor: colors.borderLight, marginVertical: 2 },
    timelineContent: { flex: 1, paddingBottom: spacing.md },
    timelineTime: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.text },
    timelineWho: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: typography.medium,
    },

    // Time pickers
    timePickers: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    timePicker: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    timePickerLabel: {
      fontSize: 11,
      fontWeight: typography.bold,
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    timePickerValue: {
      fontSize: typography.xxxl,
      fontWeight: typography.bold,
      color: colors.text,
      letterSpacing: -0.5,
    },
    timePickerSep: { paddingTop: spacing.lg },

    durationBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs + 2,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 1,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    durationText: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.primary, flex: 1 },
    durationSep: { width: 1, height: 14, backgroundColor: colors.border },
    durationConflict: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.error },

    quickRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xl },
    quickChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 1,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickChipText: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textSecondary },

    purposeInput: {
      minHeight: 88,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: typography.base,
      color: colors.text,
      backgroundColor: colors.inputBackground,
      lineHeight: 22,
    },

    conflictCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      marginTop: spacing.md,
      backgroundColor: colors.errorLight,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.error,
    },
    conflictTitle: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.error, marginBottom: 3 },
    conflictText: { fontSize: typography.xs, color: colors.error, lineHeight: 17 },

    modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
    cancelBtn: {
      flex: 1,
      paddingVertical: spacing.md + 2,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    cancelBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textSecondary },
    submitBtn: {
      flex: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs + 2,
      paddingVertical: spacing.md + 2,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      ...shadows.md,
    },
    submitBtnDisabled: { opacity: 0.4 },
    submitBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textOnPrimary },

    footerTip: {
      fontSize: typography.xs,
      color: colors.textTertiary,
      textAlign: "center",
      marginTop: spacing.md,
      lineHeight: 18,
    },

    // Scanner (black shell intentional — camera UI)
    scannerShell: { flex: 1, backgroundColor: colors.black },
    scannerTopBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 52,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    scannerClose: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    scannerLabel: { fontSize: typography.base, fontWeight: typography.bold, color: colors.white },
    scannerBottom: { padding: spacing.xxxl, alignItems: "center", gap: spacing.xxl },
    scannerFrame: {
      width: 200,
      height: 200,
      borderRadius: borderRadius.xl,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.5)",
      backgroundColor: "transparent",
    },
    scannerHint: {
      fontSize: typography.sm,
      color: "rgba(255,255,255,0.7)",
      textAlign: "center",
      fontWeight: typography.medium,
    },
    scannerPermBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.xxxl,
    },
    scannerPermText: {
      fontSize: typography.base,
      color: colors.textTertiary,
      textAlign: "center",
      fontWeight: typography.medium,
    },
    primaryBtn: {
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
    },
    primaryBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textOnPrimary },
  });