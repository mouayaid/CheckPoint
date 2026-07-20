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
import { useAuth } from "../context/AuthContext";
import { roleToString } from "../utils/helpers";
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

const formatTunisiaDateKey = (date) => {
  const parts = getTunisiaParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
};

const formatTunisiaTime = (date) => {
  const parts = getTunisiaParts(date);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(
    2,
    "0",
  )}`;
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

const getTunisiaWallClockParts = (date = new Date()) => getTunisiaParts(date);

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

const createTimePickerValue = (hour, minute) => {
  const value = new Date();
  value.setHours(hour, minute, 0, 0);
  return value;
};

const createTimePickerValueFromInstant = (instant) => {
  const { hour, minute } = getTunisiaWallClockParts(instant);
  return createTimePickerValue(hour, minute);
};

const getTimePartsFromPickerValue = (timeDateObj) => ({
  hour: timeDateObj.getHours(),
  minute: timeDateObj.getMinutes(),
});

const makeTunisiaInstant = (dateStr, hour, minute) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(
    Date.UTC(y, m - 1, d, hour, minute, 0, 0) -
      TUNISIA_UTC_OFFSET_MINUTES * 60000,
  );
};

const formatTunisiaLocalDateTimePayload = (dateStr, timeDateObj) => {
  const { hour, minute } = getTimePartsFromPickerValue(timeDateObj);
  return `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0",
  )}:00`;
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
  const s = parseApiInstant(start);
  const e = parseApiInstant(end);
  const date = s.toLocaleDateString("fr-FR", {
    timeZone: TUNISIA_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const startFormatted = formatTunisiaTime(s);
  const endFormatted = formatTunisiaTime(e);
  return `${date} · ${startFormatted} – ${endFormatted}`;
};

const combineDateAndTime = (dateStr, timeDateObj) => {
  const { hour, minute } = getTimePartsFromPickerValue(timeDateObj);
  return makeTunisiaInstant(dateStr, hour, minute);
};

function normalizeStatusKey(status) {
  if (status === 1) return "active";
  if (status === 2) return "cancelled";
  if (status === 3) return "completed";
  if (status === 5) return "inprogress";
  if (status === 6) return "expired";
  return String(status ?? "").toLowerCase();
}

const isCancelledReservation = (reservation) => {
  const status = reservation?.status ?? reservation?.Status;
  if (status === 2) return true;
  const key = normalizeStatusKey(status);
  return key === "cancelled" || key === "canceled";
};

const withoutCancelledReservations = (reservations = []) =>
  reservations.filter((reservation) => !isCancelledReservation(reservation));

const getBlockingRange = (reservation) => {
  const key = normalizeStatusKey(reservation.status ?? reservation.Status);
  if (key !== "active" && key !== "inprogress") {
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

  const start = parseApiInstant(startSource);
  if (Number.isNaN(start.getTime())) return null;

  if (key === "inprogress") {
    return { start, end: null };
  }

  const end = parseApiInstant(
    reservation.endDateTime || reservation.endDate || reservation.end,
  );
  if (Number.isNaN(end.getTime())) return null;

  return { start, end };
};

const getBlockingReservations = (reservations = []) =>
  reservations.filter((reservation) => getBlockingRange(reservation) != null);

const getReservationPlannedDateKey = (reservation) => {
  const startSource =
    reservation.startDateTime ||
    reservation.StartDateTime ||
    reservation.startDate ||
    reservation.start;

  const start = parseApiInstant(startSource);
  return Number.isNaN(start.getTime()) ? null : formatTunisiaDateKey(start);
};

const getDisplayedReservations = (reservations, selectedDate) => {
  const isToday = selectedDate === formatTunisiaDateKey(new Date());

  return getBlockingReservations(reservations).filter((reservation) => {
    const key = normalizeStatusKey(reservation.status ?? reservation.Status);
    if (key === "inprogress") return true;

    if (getReservationPlannedDateKey(reservation) !== selectedDate) {
      return false;
    }

    if (!isToday) return true;

    const endSource =
      reservation.endDateTime ||
      reservation.EndDateTime ||
      reservation.endDate ||
      reservation.end;
    const plannedEnd = parseApiInstant(endSource);

    return !Number.isNaN(plannedEnd.getTime()) && plannedEnd >= new Date();
  });
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
  return instant >= range.start && instant < range.end;
};

const getNextTunisiaQuarterTime = (nowInstant = new Date()) => {
  const parts = getTunisiaWallClockParts(nowInstant);
  const totalMinutes = parts.hour * 60 + parts.minute;
  const nextQuarterTotal = Math.floor(totalMinutes / 15) * 15 + 15;

  if (nextQuarterTotal >= 24 * 60) {
    return null;
  }

  return {
    hour: Math.floor(nextQuarterTotal / 60),
    minute: nextQuarterTotal % 60,
  };
};

const findNextAvailableSlot = (reservations, dateStr, durationMinutes = 60) => {
  const todayKey = formatTunisiaDateKey(new Date());
  if (dateStr < todayKey) return null;

  const dayStart = makeTunisiaInstant(dateStr, 0, 0);
  const nextDate = parseDateKey(dateStr);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = formatDateKey(nextDate);
  const dayEnd = makeTunisiaInstant(nextDateStr, 0, 0);
  const sorted = getBlockingReservations(reservations)
    .map((reservation) => getBlockingRange(reservation))
    .sort((a, b) => a.start - b.start);
  let candidateStart = new Date(dayStart);
  if (dateStr === todayKey) {
    const nextQuarter = getNextTunisiaQuarterTime();
    if (!nextQuarter) return null;
    const nextQuarterInstant = makeTunisiaInstant(
      dateStr,
      nextQuarter.hour,
      nextQuarter.minute,
    );
    if (nextQuarterInstant > candidateStart) {
      candidateStart = nextQuarterInstant;
    }
  }
  if (candidateStart >= dayEnd) return null;
  for (const range of sorted) {
    const candidateEnd = new Date(candidateStart);
    candidateEnd.setMinutes(candidateEnd.getMinutes() + durationMinutes);
    if (candidateEnd < dayEnd && candidateEnd <= range.start) {
      return {
        start: createTimePickerValueFromInstant(candidateStart),
        end: createTimePickerValueFromInstant(candidateEnd),
      };
    }
    if (range.end == null) return null;
    if (candidateStart < range.end) candidateStart = new Date(range.end);
  }
  const finalEnd = new Date(candidateStart);
  finalEnd.setMinutes(finalEnd.getMinutes() + durationMinutes);
  if (finalEnd < dayEnd) {
    return {
      start: createTimePickerValueFromInstant(candidateStart),
      end: createTimePickerValueFromInstant(finalEnd),
    };
  }
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
  return (
    error.data?.errors?.[0] ||
    error.response?.data?.errors?.[0] ||
    error.message ||
    error.data?.message ||
    error.response?.data?.message ||
    fallback
  );
}

/** Start / finish meeting actions for a room reservation row */
function getRoomResActionState(reservation, now = new Date()) {
  const key = normalizeStatusKey(reservation.status ?? reservation.Status);
  const isStarted = !!(reservation.startedAt || reservation.StartedAt);
  const start = parseApiInstant(
    reservation.startDateTime || reservation.StartDateTime,
  );
  const startWindowOpensAt = new Date(start.getTime() - 15 * 60 * 1000);
  const startDeadline = new Date(start.getTime() + 10 * 60 * 1000);
  const isInsideStartWindow =
    !Number.isNaN(start.getTime()) &&
    now >= startWindowOpensAt &&
    now <= startDeadline;
  const canStart = key === "active" && !isStarted && isInsideStartWindow;
  const canFinish = key === "inprogress";
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
  const { user } = useAuth();
  const userRole = roleToString(
    user?.roleName ?? user?.role?.name ?? user?.roleId ?? user?.role,
  );
  const canManageRooms = userRole === "Manager";
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const { feedback, showFeedback, hideFeedback } = useFeedback();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
  );
  const showError = (title, message) =>
    showFeedback({
      type: "error",
      title,
      message,
      confirmText: "Compris",
    });
  const showSuccessMessage = (title, message) =>
    showFeedback({
      type: "success",
      title,
      message,
      confirmText: "OK",
    });

  const [lifecycleNow, setLifecycleNow] = useState(() => new Date());
  const today = useMemo(
    () => createTunisiaDateTimeCarrier(lifecycleNow),
    [lifecycleNow],
  );
  const todayStr = useMemo(
    () => formatTunisiaDateKey(lifecycleNow),
    [lifecycleNow],
  );
  const currentWeekStart = useMemo(() => startOfWeekMonday(today), [today]);

  const [weekStartDate, setWeekStartDate] = useState(() =>
    startOfWeekMonday(createTunisiaDateTimeCarrier()),
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    formatTunisiaDateKey(new Date()),
  );

  useEffect(() => {
    const timer = setInterval(() => setLifecycleNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

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
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const workDays = useMemo(
    () => getWorkWeekDays(weekStartDate),
    [weekStartDate],
  );

  useFocusEffect(
    useCallback(() => {
      if (canManageRooms) loadInitialData();
    }, [canManageRooms]),
  );
  useEffect(() => {
    if (
      canManageRooms &&
      rooms.length > 0 &&
      selectedDate >= todayStr &&
      weekStartDate >= currentWeekStart
    )
      loadRoomStatusesForSelectedDate();
  }, [
    canManageRooms,
    currentWeekStart,
    rooms,
    selectedDate,
    todayStr,
    weekStartDate,
  ]);
  useEffect(() => {
    if (
      canManageRooms &&
      modalVisible &&
      selectedRoom?.id &&
      selectedDate >= todayStr
    )
      loadReservationsForSelected();
  }, [canManageRooms, modalVisible, selectedDate, selectedRoom, todayStr]);
  useEffect(() => {
    if (weekStartDate < currentWeekStart || selectedDate < todayStr) {
      setSelectedDate(todayStr);
      setWeekStartDate(currentWeekStart);
    }
  }, [currentWeekStart, selectedDate, todayStr, weekStartDate]);
  useEffect(() => {
    if (!scannerVisible) {
      scanLockRef.current = false;
      setScanning(false);
    }
  }, [scannerVisible]);

  const loadInitialData = async () => {
    if (!canManageRooms) return;
    await Promise.all([loadRooms(), loadMyReservations()]);
  };

  const onRefresh = async () => {
    if (!canManageRooms) return;
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
    if (!canManageRooms) return;
    try {
      const response = await roomService.getAllRooms();
      if (response?.success) setRooms(response.data || []);
      else
        showError(
          "Impossible de charger les salles",
          response?.message || "Actualisez la page puis réessayez.",
        );
    } catch (error) {
      showError(
        "Impossible de charger les salles",
        getErrorMessage(error, "Vérifiez votre connexion puis réessayez."),
      );
    }
  };

  const loadMyReservations = async () => {
    if (!canManageRooms) return;
    setLoadingMyReservations(true);
    try {
      const response = await roomService.getMyReservations();
      setMyReservations(
        response?.success ? withoutCancelledReservations(response.data || []) : [],
      );
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
      showError(
        "Permission refusée",
        "L'accès à la caméra est nécessaire pour scanner le QR de la salle.",
      );
    return result?.granted ?? false;
  };

  const denyRoomAccess = () => {
    showError(
      "Accès refusé",
      "Seuls les managers peuvent gérer les réservations de salles.",
    );
  };

  const handleScanPress = async (resId) => {
    if (!canManageRooms) {
      denyRoomAccess();
      return;
    }
    setScanningResId(resId);
    scanLockRef.current = false;
    const granted = await ensureCameraPermission();
    if (granted) setScannerVisible(true);
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (!canManageRooms) {
      setScannerVisible(false);
      denyRoomAccess();
      return;
    }
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setScanning(true);
    const releaseScan = () => {
      scanLockRef.current = false;
      setScanning(false);
    };

    const roomId = parseRoomQrPayload(data);
    if (roomId == null) {
      releaseScan();
      showError(
        "QR invalide",
        "Ce code ne correspond pas à une salle. Utilisez le QR permanent affiché dans la salle.",
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
      showError(
        "Mauvaise salle",
        `Ce QR ne correspond pas à la salle réservée (${roomLabel}).`,
      );
      return;
    }

    try {
      await roomReservationService.scanStart(scanningResId, roomId);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      setScannerVisible(false);
      await loadMyReservations();
      await loadRoomStatusesForSelectedDate();
      showSuccessMessage("Réunion démarrée", "La réunion a bien démarré.");
    } catch (error) {
      showError(
        "Action impossible",
        getErrorMessage(error, "Cette action est impossible pour le moment."),
      );
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
        return {
          ok: true,
          data: withoutCancelledReservations(res.data || []),
          message: null,
        };
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
    if (!canManageRooms) return;
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
    if (!canManageRooms || !selectedRoom?.id) return;
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
      setStartTime(suggestion?.start ?? null);
      setEndTime(suggestion?.end ?? null);
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

  const handleOpenModal = (room) => {
    if (!canManageRooms) {
      denyRoomAccess();
      return;
    }
    setSelectedRoom(room);
    setModalVisible(true);
    setModalScheduleError(null);
    setStartTime(null);
    setEndTime(null);
  };

  const applyQuickDuration = (minutes) => {
    if (!startTime) return;
    const nextEnd = new Date(startTime);
    nextEnd.setMinutes(nextEnd.getMinutes() + minutes);
    setEndTime(nextEnd);
  };

  const handleReserve = async () => {
    if (!canManageRooms) {
      denyRoomAccess();
      return;
    }
    if (!selectedRoom?.id) {
      showError("Aucune salle sélectionnée", "Choisissez d'abord une salle.");
      return;
    }
    if (!startTime || !endTime) {
      showError(
        "Plage horaire requise",
        "Sélectionnez une heure de début et une heure de fin.",
      );
      return;
    }
    if (!purpose.trim()) {
      showError("Objet requis", "Décrivez brièvement la réunion.");
      return;
    }
    const startDateTime = combineDateAndTime(selectedDate, startTime);
    const endDateTime = combineDateAndTime(selectedDate, endTime);
    if (endDateTime <= startDateTime) {
      showError(
        "Plage invalide",
        "L'heure de fin doit être après l'heure de début.",
      );
      return;
    }
    if (startDateTime <= new Date()) {
      showError(
        "Plage invalide",
        "L'heure de début doit être dans le futur.",
      );
      return;
    }
    if (hasOverlap(startDateTime, endDateTime)) {
      showError(
        "Conflit horaire",
        "Ce créneau chevauche une réservation existante.",
      );
      return;
    }
    setReserving(true);
    try {
      const payload = {
        roomId: Number(selectedRoom.id),
        startDateTime: formatTunisiaLocalDateTimePayload(
          selectedDate,
          startTime,
        ),
        endDateTime: formatTunisiaLocalDateTimePayload(selectedDate, endTime),
        purpose: purpose.trim(),
      };
      const response = await roomReservationService.createReservation(payload);
      if (response?.success) {
        await Promise.all([
          loadReservationsForSelected(),
          loadMyReservations(),
          loadRoomStatusesForSelectedDate(),
        ]);
        resetModal();

        showSuccessMessage(
          "Réservation confirmée",
          "Votre réservation a bien été confirmée.",
        );
      } else {
        showError(
          "Opération échouée",
          response?.message || "Une erreur est survenue. Réessayez dans un instant.",
        );
      }
    } catch (error) {
      const status = error?.status || error?.response?.status;
      const msg = getErrorMessage(error, "Impossible de créer la réservation.");
      if (status === 409) showError("Créneau indisponible", msg);
      else if (status === 400) showError("Demande invalide", msg);
      else showError("Opération échouée", msg);
    } finally {
      setReserving(false);
    }
  };

  const getRoomAvailability = (roomId) => {
    const reservations = roomDayStatusMap[roomId] || [];
    const blockingReservations = getBlockingReservations(reservations);
    if (loadingRoomStatuses)
      return { label: "Vérification…", color: colors.textTertiary };
    if (roomDayLoadError)
      return { label: "Aucune donnée", color: colors.textTertiary };
    if (blockingReservations.length === 0)
      return { label: "Libre", color: colors.success };
    if (
      blockingReservations.some(
        (r) => normalizeStatusKey(r.status ?? r.Status) === "inprogress",
      )
    ) {
      return { label: "Réunion en cours", color: colors.error };
    }
    if (selectedDate === todayStr) {
      const now = new Date();
      const busyNow = blockingReservations.some((r) =>
        isInstantBlockedByReservation(r, now),
      );
      if (busyNow) return { label: "Occupée", color: colors.error };
    }
    return {
      label: `${blockingReservations.length} créneau${blockingReservations.length > 1 ? "x" : ""}`,
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
      const blockingCount = getBlockingReservations(reservations).length;
      if (blockingCount === 0) freeAllDay += 1;
      else partial += 1;
    });
    return { freeAllDay, partial };
  }, [rooms, roomDayStatusMap, roomDayLoadError]);

  const displayedDayReservations = useMemo(
    () => getDisplayedReservations(dayReservations, selectedDate),
    [dayReservations, selectedDate],
  );

  // selectedDate is a Tunisia YYYY-MM-DD key. startTime/endTime are picker
  // carrier values whose local hour/minute represent Tunisia wall-clock time;
  // the backend receives YYYY-MM-DDTHH:mm:ss and interprets it as Tunisia local.
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
    combinedStart > new Date() &&
    !modalScheduleError;

  const handleCancelReservation = async (reservationId) => {
    if (!canManageRooms) {
      denyRoomAccess();
      return;
    }
    setCancelReservationId(reservationId);
  };

  const handleFinishReservation = async (reservationId) => {
    if (!canManageRooms) {
      denyRoomAccess();
      return;
    }
    setFinishReservationId(reservationId);
  };

  const closeFinishModal = () => {
    if (!finishingReservation) setFinishReservationId(null);
  };

  const confirmFinishReservation = async () => {
    if (!canManageRooms) {
      denyRoomAccess();
      return;
    }
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
      showSuccessMessage(
        "Réunion terminée",
        "La salle est maintenant libérée.",
      );
    } catch (error) {
      showError(
        "Opération échouée",
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
    if (!canManageRooms) {
      denyRoomAccess();
      return;
    }
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
      showSuccessMessage(
        "Réservation annulée",
        "La réservation a bien été annulée.",
      );
    } catch (error) {
      showError(
        "Opération échouée",
        getErrorMessage(error, "Impossible d'annuler la réservation."),
      );
    } finally {
      setCancellingReservation(false);
    }
  };

  if (!canManageRooms) {
    return (
      <View style={styles.accessDeniedContainer}>
        <Ionicons
          name="lock-closed-outline"
          size={48}
          color={colors.textTertiary}
        />
        <Text style={styles.accessDeniedTitle}>Accès refusé</Text>
        <Text style={styles.accessDeniedMessage}>
          La réservation de salles est réservée aux managers.
        </Text>
      </View>
    );
  }

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
          canManageRooms={canManageRooms}
          myReservations={myReservations}
          loadingMyReservations={loadingMyReservations}
          reservationIdOf={reservationIdOf}
          getRoomResActionState={(reservation) =>
            getRoomResActionState(reservation, lifecycleNow)
          }
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
          getRoomAvailability={getRoomAvailability}
          getBlockingReservationCount={(roomId) =>
            getBlockingReservations(roomDayStatusMap[roomId] || []).length
          }
          onRoomPress={canManageRooms ? handleOpenModal : undefined}
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
        displayedReservations={displayedDayReservations}
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

    accessDeniedContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xxxl,
      backgroundColor: colors.background,
    },
    accessDeniedTitle: {
      marginTop: spacing.md,
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
    },
    accessDeniedMessage: {
      marginTop: spacing.sm,
      fontSize: typography.base,
      color: colors.textSecondary,
      textAlign: "center",
    },

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
