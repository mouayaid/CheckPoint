import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  UIManager,
  ActivityIndicator,
} from "react-native";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import roomService from "../services/api/roomService";
import { roomReservationService } from "../services/api/roomReservationService";
import { useTheme } from "../context/ThemeContext";
import RoomFilterBar from "../components/rooms/RoomFilterBar";
import RoomList from "../components/rooms/RoomList";
import ReservationModal from "../components/rooms/ReservationModal";
import MyReservations from "../components/rooms/MyReservations";
import ConfirmActionModal from "../components/common/ConfirmActionModal";
import FeedbackModal from "../components/FeedbackModal";
import { useFeedback } from "../hooks/useFeedback";

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

const formatReservationDate = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const startFormatted = s.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endFormatted = e.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${startFormatted} – ${endFormatted}`;
};

const combineDateAndTime = (dateStr, timeDateObj) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const hh = timeDateObj.getHours();
  const mm = timeDateObj.getMinutes();
  return new Date(y, m - 1, d, hh, mm, 0, 0);
};

function normalizeStatusKey(status) {
  if (typeof status === "number" && Number.isFinite(status)) {
    // Backend ReservationStatus: Pending=0, Active=1, Cancelled=2, Completed=3, Rejected=4, InProgress=5
    const map = {
      0: "pending",
      1: "active",
      2: "cancelled",
      3: "completed",
      4: "rejected",
      5: "inprogress",
    };
    return map[status] ?? String(status);
  }
  return String(status ?? "").toLowerCase();
}

const getBlockingRange = (reservation) => {
  const key = normalizeStatusKey(reservation.status ?? reservation.Status);
  if (key !== "pending" && key !== "active" && key !== "inprogress") {
    return null;
  }

  const startSource =
    key === "inprogress"
      ? reservation.startedAt ||
        reservation.StartedAt ||
        reservation.startDateTime ||
        reservation.startDate ||
        reservation.start
      : reservation.startDateTime || reservation.startDate || reservation.start;

  const start = new Date(startSource);
  if (Number.isNaN(start.getTime())) return null;

  if (key === "inprogress") {
    return { start, end: null };
  }

  const end = new Date(
    reservation.endDateTime || reservation.endDate || reservation.end,
  );
  if (Number.isNaN(end.getTime())) return null;

  return { start, end };
};

const overlapsBlockingReservation = (reservation, start, end) => {
  const range = getBlockingRange(reservation);
  if (!range) return false;
  if (range.end == null) return range.start < end;
  return start < range.end && end > range.start;
};

const isInstantBlockedByReservation = (reservation, instant) => {
  const range = getBlockingRange(reservation);
  if (!range) return false;
  if (range.end == null) return range.start <= instant;
  return instant >= range.start && instant <= range.end;
};


const findNextAvailableSlot = (reservations, dateStr, durationMinutes = 60) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const workStart = new Date(y, m - 1, d, 8, 0, 0, 0);
  const workEnd = new Date(y, m - 1, d, 17, 0, 0, 0);
  const sorted = reservations
    .map((reservation) => getBlockingRange(reservation))
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
  let candidateStart = new Date(workStart);
  for (const range of sorted) {
    const candidateEnd = new Date(candidateStart);
    candidateEnd.setMinutes(candidateEnd.getMinutes() + durationMinutes);
    if (candidateEnd <= range.start)
      return { start: candidateStart, end: candidateEnd };
    if (range.end == null) return null;
    if (candidateStart < range.end) candidateStart = new Date(range.end);
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

const isWithinWorkHours = (start, end) => {
  if (!start || !end) return false;

  const workStart = new Date(start);
  workStart.setHours(8, 0, 0, 0);

  const workEnd = new Date(start);
  workEnd.setHours(17, 0, 0, 0);

  return start >= workStart && end <= workEnd;
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
  return (
    error.message ||
    error.data?.message ||
    error.response?.data?.message ||
    fallback
  );
}

/** Start / finish meeting actions for a room reservation row */
function getRoomResActionState(reservation) {
  const key = normalizeStatusKey(reservation.status ?? reservation.Status);
  const isStarted = !!(reservation.startedAt || reservation.StartedAt);
  const canStart = key === "active" && !isStarted;
  const canFinish =
    (key === "inprogress" || isStarted) &&
    key !== "completed" &&
    key !== "cancelled";
  return { key, isStarted, canStart, canFinish };
}

function parseRoomQrPayload(data) {
  const trimmed = String(data ?? "").trim();
  const match = trimmed.match(/^ROOM:(\d+)$/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function reservationIdOf(r) {
  return r?.id ?? r?.Id;
}

function reservationRoomIdOf(r) {
  const v = r?.roomId ?? r?.RoomId;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function RoomReservationScreen({ navigation }) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const { feedback, showFeedback, hideFeedback } = useFeedback();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
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
  const [cancelReservationId, setCancelReservationId] = useState(null);
  const [cancellingReservation, setCancellingReservation] = useState(false);
  const [finishReservationId, setFinishReservationId] = useState(null);
  const [finishingReservation, setFinishingReservation] = useState(false);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanningResId, setScanningResId] = useState(null);
  const [scanningAction, setScanningAction] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const workDays = useMemo(
    () => getWorkWeekDays(weekStartDate),
    [weekStartDate],
  );

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, []),
  );
  useEffect(() => {
    if (rooms.length > 0) loadRoomStatusesForSelectedDate();
  }, [rooms, selectedDate]);
  useEffect(() => {
    if (modalVisible && selectedRoom?.id) loadReservationsForSelected();
  }, [selectedDate, modalVisible, selectedRoom]);
  useEffect(() => {
    if (!scannerVisible) {
      scanLockRef.current = false;
      setScanning(false);
    }
  }, [scannerVisible]);

  const loadInitialData = async () => {
    await Promise.all([loadRooms(), loadMyReservations()]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadRooms(),
        loadMyReservations(),
        rooms.length > 0
          ? loadRoomStatusesForSelectedDate()
          : Promise.resolve(),
      ]);
      if (modalVisible && selectedRoom?.id) await loadReservationsForSelected();
    } finally {
      setRefreshing(false);
    }
  };

  const loadRooms = async () => {
    try {
      const response = await roomService.getAllRooms();
      if (response?.success) setRooms(response.data || []);
      else
        Alert.alert(
          "Impossible de charger les salles",
          response?.message || "Actualiser et réessayer.",
        );
    } catch (error) {
      Alert.alert(
        "Impossible de charger les salles",
        getErrorMessage(error, "Vérifiez votre connexion."),
      );
    }
  };

  const loadMyReservations = async () => {
    setLoadingMyReservations(true);
    try {
      const response = await roomService.getMyReservations();
      setMyReservations(response?.success ? response.data || [] : []);
    } catch {
      setMyReservations([]);
    } finally {
      setLoadingMyReservations(false);
    }
  };

  const ensureCameraPermission = async () => {
    if (cameraPermission?.granted) return true;
    const result = await requestCameraPermission();
    if (!result?.granted)
      Alert.alert(
        "Permission refusée",
        "Accès caméra nécessaire pour scanner le QR.",
      );
    return result?.granted ?? false;
  };

  const handleScanPress = async (resId, action) => {
    setScanningResId(resId);
    setScanningAction(action);
    scanLockRef.current = false;
    const granted = await ensureCameraPermission();
    if (granted) setScannerVisible(true);
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setScanning(true);
    console.log("QR DATA:", data);

    const releaseScan = () => {
      scanLockRef.current = false;
      setScanning(false);
    };

    const roomId = parseRoomQrPayload(data);
    if (roomId == null) {
      releaseScan();
      Alert.alert(
        "QR invalide",
        "Ce code ne correspond pas à une salle. Utilisez le QR fixe sur la salle (format ROOM:ID).",
      );
      return;
    }

    const resRow = myReservations.find(
      (r) => reservationIdOf(r) === scanningResId,
    );
    const expectedRoomId = reservationRoomIdOf(resRow);
    if (expectedRoomId != null && roomId !== expectedRoomId) {
      releaseScan();
      const roomLabel = resRow?.roomName ?? resRow?.RoomName ?? "votre salle";
      Alert.alert(
        "Mauvaise salle",
        `Ce QR ne correspond pas à la salle réservée (${roomLabel}).`,
      );
      return;
    }

    try {
      if (scanningAction === "finish") {
        await roomReservationService.scanFinish(scanningResId, roomId);
      } else {
        await roomReservationService.scanStart(scanningResId, roomId);
      }
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      setScannerVisible(false);
      await loadMyReservations();
      await loadRoomStatusesForSelectedDate();
      showFeedback({
        type: "success",
        title: scanningAction === "finish" ? "Réunion terminée" : "Réunion démarrée",
        message: scanningAction === "finish"
          ? "La réunion est terminée."
          : "La réunion a démarré.",
      });
    } catch (error) {
      Alert.alert("Erreur", getErrorMessage(error, "Action impossible."));
    } finally {
      releaseScan();
    }
  };

  const fetchReservationsForRoomAndDate = async (roomId, date) => {
    try {
      const res = await roomReservationService.getReservationsForDay(
        roomId,
        date,
      );
      if (res?.success)
        return { ok: true, data: res.data || [], message: null };
      return {
        ok: false,
        data: [],
        message: res?.message || "Impossible de charger les réservations.",
      };
    } catch (error) {
      return {
        ok: false,
        data: [],
        message: getErrorMessage(
          error,
          "Impossible de charger les réservations.",
        ),
      };
    }
  };

  const loadRoomStatusesForSelectedDate = async () => {
    setLoadingRoomStatuses(true);
    setRoomDayLoadError(null);
    try {
      if (rooms.length === 0) {
        setRoomDayStatusMap({});
        return;
      }
      const results = await Promise.all(
        rooms.map(async (room) => {
          const out = await fetchReservationsForRoomAndDate(
            room.id,
            selectedDate,
          );
          return { roomId: room.id, ...out };
        }),
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        setRoomDayLoadError(
          failed.message || "Impossible de charger les disponibilités.",
        );
        setRoomDayStatusMap({});
        return;
      }
      const map = {};
      results.forEach((item) => {
        map[item.roomId] = item.data;
      });
      setRoomDayStatusMap(map);
    } finally {
      setLoadingRoomStatuses(false);
    }
  };

  const loadReservationsForSelected = async () => {
    if (!selectedRoom?.id) return;
    setLoadingReservations(true);
    setModalScheduleError(null);
    try {
      const {
        ok,
        data: reservations,
        message,
      } = await fetchReservationsForRoomAndDate(selectedRoom.id, selectedDate);
      if (!ok) {
        setDayReservations([]);
        setModalScheduleError(message || "Impossible de charger le planning.");
        return;
      }
      setDayReservations(reservations);
      const suggestion = findNextAvailableSlot(reservations, selectedDate, 60);
      if (suggestion) {
        setStartTime(suggestion.start);
        setEndTime(suggestion.end);
      }
    } catch (error) {
      setDayReservations([]);
      setModalScheduleError(
        getErrorMessage(error, "Impossible de charger le planning."),
      );
    } finally {
      setLoadingReservations(false);
    }
  };

  const resetModal = () => {
    setStartTime(null);
    setEndTime(null);
    setPurpose("");
    setDayReservations([]);
    setLoadingReservations(false);
    setModalScheduleError(null);
    setSelectedRoom(null);
    setModalVisible(false);
    setReserving(false);
  };

  const hasOverlap = (newStart, newEnd) =>
    dayReservations.some((r) =>
      overlapsBlockingReservation(r, newStart, newEnd),
    );

  const handleOpenModal = async (room) => {
    setSelectedRoom(room);
    setModalVisible(true);
    setModalScheduleError(null);
    const selected = parseDateKey(selectedDate);
    setStartTime(
      new Date(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
        9,
        0,
      ),
    );
    setEndTime(
      new Date(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
        10,
        0,
      ),
    );
    setLoadingReservations(true);
    try {
      const {
        ok,
        data: reservations,
        message,
      } = await fetchReservationsForRoomAndDate(room.id, selectedDate);
      if (!ok) {
        setDayReservations([]);
        setModalScheduleError(message || "Impossible de charger le planning.");
        return;
      }
      setDayReservations(reservations);
      const suggestion = findNextAvailableSlot(reservations, selectedDate, 60);
      if (suggestion) {
        setStartTime(suggestion.start);
        setEndTime(suggestion.end);
      }
    } catch (error) {
      setDayReservations([]);
      setModalScheduleError(
        getErrorMessage(error, "Impossible de charger le planning."),
      );
    } finally {
      setLoadingReservations(false);
    }
  };

  const applyQuickDuration = (minutes) => {
    if (!startTime) return;
    const nextEnd = new Date(startTime);
    nextEnd.setMinutes(nextEnd.getMinutes() + minutes);
    setEndTime(nextEnd);
  };

  const handleReserve = async () => {
    if (!selectedRoom?.id) {
      Alert.alert("Aucune salle", "Choisissez d'abord une salle.");
      return;
    }
    if (!startTime || !endTime) {
      Alert.alert(
        "Plage horaire requise",
        "Sélectionnez une heure de début et de fin.",
      );
      return;
    }
    if (!purpose.trim()) {
      Alert.alert("Objet requis", "Décrivez brièvement la réunion.");
      return;
    }
    const startDateTime = combineDateAndTime(selectedDate, startTime);
    const endDateTime = combineDateAndTime(selectedDate, endTime);
    if (endDateTime <= startDateTime) {
      Alert.alert("Plage invalide", "L'heure de fin doit être après le début.");
      return;
    }
    if (!isWithinWorkHours(startDateTime, endDateTime)) {
      Alert.alert(
        "Horaire non autorisé",
        "Les réservations sont possibles uniquement entre 08:00 et 17:00.",
      );
      return;
    }
    if (hasOverlap(startDateTime, endDateTime)) {
      Alert.alert(
        "Conflit horaire",
        "Ce créneau chevauche une réservation existante.",
      );
      return;
    }
    setReserving(true);
    try {
      const payload = {
        roomId: Number(selectedRoom.id),
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        purpose: purpose.trim(),
      };
      const response = await roomReservationService.createReservation(payload);
      if (response?.success) {
        const created = response.data;
        const newId = reservationIdOf(created);
        const canOfferScan =
          newId != null &&
          normalizeStatusKey(created?.status ?? created?.Status) === "active";

        await Promise.all([
          loadReservationsForSelected(),
          loadMyReservations(),
          loadRoomStatusesForSelectedDate(),
        ]);
        resetModal();

        if (canOfferScan) {
          showFeedback({
            type: "success",
            title: "Réservation confirmée",
            message: "Votre salle est réservée. Vous pouvez démarrer la réunion en scannant le QR de la salle.",
            cancelText: "Plus tard",
            confirmText: "Scanner le QR",
            onConfirm: () => handleScanPress(newId, "start"),
          });
        } else {
          showFeedback({
            type: "success",
            title: "Réservation confirmée",
            message: response.message || "Votre réservation est confirmée.",
          });
        }
      } else {
        Alert.alert("Échec", response?.message || "Une erreur s'est produite.");
      }
    } catch (error) {
      const status = error?.status || error?.response?.status;
      const msg = getErrorMessage(error, "Impossible de créer la réservation.");
      if (status === 409) Alert.alert("Créneau indisponible", msg);
      else if (status === 400) Alert.alert("Demande invalide", msg);
      else Alert.alert("Échec", msg);
    } finally {
      setReserving(false);
    }
  };

  const getRoomAvailability = (roomId) => {
    const reservations = roomDayStatusMap[roomId] || [];
    if (loadingRoomStatuses)
      return { label: "Vérification…", color: colors.textTertiary };
    if (roomDayLoadError)
      return { label: "Aucune donnée", color: colors.textTertiary };
    if (reservations.length === 0)
      return { label: "Libre", color: colors.success };
    if (selectedDate === todayStr) {
      const now = new Date();
      const busyNow = reservations.some((r) =>
        isInstantBlockedByReservation(r, now),
      );
      if (busyNow) return { label: "Occupée", color: colors.error };
    }
    return {
      label: `${reservations.length} créneau${reservations.length > 1 ? "x" : ""}`,
      color: colors.warning,
    };
  };

  const selectedDateReadable = useMemo(
    () =>
      parseDateKey(selectedDate).toLocaleDateString("fr-FR", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [selectedDate],
  );

  const selectedDayRoomSummary = useMemo(() => {
    if (roomDayLoadError) return null;
    let freeAllDay = 0,
      partial = 0;
    rooms.forEach((room) => {
      const reservations = roomDayStatusMap[room.id] || [];
      if (reservations.length === 0) freeAllDay += 1;
      else partial += 1;
    });
    return { freeAllDay, partial };
  }, [rooms, roomDayStatusMap, roomDayLoadError]);

  const durationMinutes =
    startTime && endTime
      ? getDurationMinutes(
          combineDateAndTime(selectedDate, startTime),
          combineDateAndTime(selectedDate, endTime),
        )
      : 0;
  const overlapWarning =
    startTime && endTime
      ? hasOverlap(
          combineDateAndTime(selectedDate, startTime),
          combineDateAndTime(selectedDate, endTime),
        )
      : false;
  const combinedStart =
    startTime && selectedDate
      ? combineDateAndTime(selectedDate, startTime)
      : null;
  const combinedEnd =
    endTime && selectedDate ? combineDateAndTime(selectedDate, endTime) : null;
  const canSubmitRequest =
    !!selectedRoom?.id &&
    !!startTime &&
    !!endTime &&
    purpose.trim().length > 0 &&
    !overlapWarning &&
    !!combinedStart &&
    !!combinedEnd &&
    combinedEnd > combinedStart &&
    isWithinWorkHours(combinedStart, combinedEnd) &&
    !modalScheduleError;

  const handleCancelReservation = async (reservationId) => {
    setCancelReservationId(reservationId);
  };

  const handleFinishReservation = async (reservationId) => {
    setFinishReservationId(reservationId);
  };

  const closeFinishModal = () => {
    if (!finishingReservation) setFinishReservationId(null);
  };

  const confirmFinishReservation = async () => {
    if (!finishReservationId) return;

    setFinishingReservation(true);
    try {
      await roomReservationService.finishReservation(finishReservationId);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );

      await Promise.all([
        loadMyReservations(),
        loadRoomStatusesForSelectedDate(),
        modalVisible && selectedRoom?.id
          ? loadReservationsForSelected()
          : Promise.resolve(),
      ]);

      setFinishReservationId(null);
      showFeedback({
        type: "success",
        title: "Réunion terminée",
        message: "La salle est maintenant libérée.",
      });
    } catch (error) {
      Alert.alert(
        "Erreur",
        getErrorMessage(error, "Impossible de terminer la réunion."),
      );
    } finally {
      setFinishingReservation(false);
    }
  };

  const closeCancelModal = () => {
    if (!cancellingReservation) setCancelReservationId(null);
  };

  const confirmCancelReservation = async () => {
    if (!cancelReservationId) return;

    setCancellingReservation(true);
    try {
      await roomReservationService.cancelReservation(cancelReservationId);

      await Promise.all([
        loadMyReservations(),
        loadRoomStatusesForSelectedDate(),
        modalVisible && selectedRoom?.id
          ? loadReservationsForSelected()
          : Promise.resolve(),
      ]);

      setCancelReservationId(null);
      Alert.alert(
        "Réservation annulée",
        "La réservation a été annulée.",
      );
    } catch (error) {
      Alert.alert(
        "Erreur",
        getErrorMessage(error, "Impossible d'annuler la réservation."),
      );
    } finally {
      setCancellingReservation(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <RoomFilterBar
          weekStartDate={weekStartDate}
          setWeekStartDate={setWeekStartDate}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          workDays={workDays}
          today={today}
          roomDayLoadError={roomDayLoadError}
          selectedDateReadable={selectedDateReadable}
          selectedDayRoomSummary={selectedDayRoomSummary}
        />

        <MyReservations
          myReservations={myReservations}
          loadingMyReservations={loadingMyReservations}
          reservationIdOf={reservationIdOf}
          getRoomResActionState={getRoomResActionState}
          formatReservationDate={formatReservationDate}
          onScanPress={handleScanPress}
          onFinishReservation={handleFinishReservation}
          onCancelReservation={handleCancelReservation}
          onOpenReservation={(reservation) =>
            navigation.navigate("MeetingWorkspace", {
              reservation,
              reservationId: reservationIdOf(reservation),
            })
          }
        />

        <RoomList
          rooms={rooms}
          roomDayStatusMap={roomDayStatusMap}
          getRoomAvailability={getRoomAvailability}
          onRoomPress={handleOpenModal}
        />
      </ScrollView>

      <Modal
        visible={scannerVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerRoot}>
          {cameraPermission?.granted ? (
            <>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={scanning ? undefined : handleBarCodeScanned}
              />
              <View style={styles.scannerOverlay} pointerEvents="box-none">
                <Text style={styles.scannerTitleAbs}>
                  Scanner le QR de la salle
                </Text>
                <View style={styles.qrFrame} />
                <Text style={styles.scannerHintAbs}>
                  Placez le QR permanent dans le cadre (comme pour votre poste).
                </Text>
                {scanning ? (
                  <ActivityIndicator
                    size="large"
                    color="#fff"
                    style={{ marginTop: 20 }}
                  />
                ) : null}
                <TouchableOpacity
                  style={styles.scannerCloseFab}
                  onPress={() => setScannerVisible(false)}
                >
                  <Ionicons name="close" size={22} color="#fff" />
                  <Text style={styles.scannerCloseFabText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.scannerPermFallback}>
              <TouchableOpacity
                style={styles.scannerCloseFabTop}
                onPress={() => setScannerVisible(false)}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
              <Ionicons
                name="camera-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text style={styles.scannerPermTextAlt}>
                Autorisation caméra requise
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={ensureCameraPermission}
              >
                <Text style={styles.primaryBtnText}>Autoriser</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <ReservationModal
        visible={modalVisible}
        resetModal={resetModal}
        selectedRoom={selectedRoom}
        selectedDate={selectedDate}
        selectedDateReadable={selectedDateReadable}
        modalScheduleError={modalScheduleError}
        loadingReservations={loadingReservations}
        dayReservations={dayReservations}
        startTime={startTime}
        endTime={endTime}
        setStartTime={setStartTime}
        setEndTime={setEndTime}
        purpose={purpose}
        setPurpose={setPurpose}
        durationMinutes={formatDuration(durationMinutes)}
        overlapWarning={overlapWarning}
        applyQuickDuration={applyQuickDuration}
        combineDateAndTime={combineDateAndTime}
        reserving={reserving}
        canSubmitRequest={canSubmitRequest}
        handleReserve={handleReserve}
      />

      <ConfirmActionModal
        visible={cancelReservationId != null}
        title="Annuler la réservation ?"
        message="Cette action libérera la salle pour ce créneau."
        cancelLabel="Garder"
        confirmLabel="Annuler"
        destructive
        loading={cancellingReservation}
        onCancel={closeCancelModal}
        onConfirm={confirmCancelReservation}
      />

      <ConfirmActionModal
        visible={finishReservationId != null}
        title="Terminer la réunion ?"
        message="La salle sera libérée immédiatement."
        cancelLabel="Retour"
        confirmLabel="Terminer"
        loading={finishingReservation}
        onCancel={closeFinishModal}
        onConfirm={confirmFinishReservation}
      />

      <FeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        confirmText={feedback.confirmText}
        cancelText={feedback.cancelText}
        onConfirm={() => {
          feedback.onConfirm?.();
          hideFeedback();
        }}
        onCancel={() => {
          feedback.onCancel?.();
          hideFeedback();
        }}
      />
    </View>
  );
}

const createStyles = (colors, spacing, borderRadius, typography, shadows) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

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

    scrollContent: { paddingBottom: 128 },

    scannerRoot: { flex: 1, backgroundColor: "#000" },
    scannerOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.28)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    scannerTitleAbs: {
      position: "absolute",
      top: 56,
      left: spacing.lg,
      right: spacing.lg,
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: "#fff",
      textAlign: "center",
    },
    qrFrame: {
      width: 240,
      height: 240,
      borderWidth: 3,
      borderColor: "#fff",
      borderRadius: 24,
      backgroundColor: "transparent",
    },
    scannerHintAbs: {
      marginTop: spacing.lg,
      color: "#fff",
      fontSize: typography.sm,
      textAlign: "center",
      fontWeight: typography.medium,
      paddingHorizontal: spacing.md,
    },
    scannerCloseFab: {
      position: "absolute",
      bottom: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.65)",
    },
    scannerCloseFabText: {
      color: "#fff",
      fontWeight: typography.bold,
      fontSize: typography.sm,
    },
    scannerPermFallback: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.xxxl,
      backgroundColor: "#000",
    },
    scannerCloseFabTop: {
      position: "absolute",
      top: 52,
      right: spacing.lg,
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    scannerPermTextAlt: {
      fontSize: typography.base,
      color: "rgba(255,255,255,0.75)",
      textAlign: "center",
      fontWeight: typography.medium,
    },
    primaryBtn: {
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
    },
    primaryBtnText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.textOnPrimary,
    },
  });
