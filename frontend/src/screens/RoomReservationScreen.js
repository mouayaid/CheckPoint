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
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import roomService from "../services/api/roomService";
import { useTheme } from "../context/ThemeContext";

const QUICK_DURATIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
];

const MY_RESERVATION_FILTERS = ["All", "Upcoming", "Past"];

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
  const day = cloned.getDay(); // 0 Sun, 1 Mon ... 6 Sat
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
  return `${formatTime(s)} - ${formatTime(e)}`;
};

const formatReservationDate = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);

  const date = s.toLocaleDateString();
  const startFormatted = s.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endFormatted = e.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date} • ${startFormatted} - ${endFormatted}`;
};

const combineDateAndTime = (dateStr, timeDateObj) => {
  const [y, m, d] = dateStr.split("-").map((x) => Number(x));
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

    if (candidateEnd <= existingStart) {
      return { start: candidateStart, end: candidateEnd };
    }

    if (candidateStart < existingEnd) {
      candidateStart = new Date(existingEnd);
    }
  }

  const finalEnd = new Date(candidateStart);
  finalEnd.setMinutes(finalEnd.getMinutes() + durationMinutes);

  if (finalEnd <= workEnd) {
    return { start: candidateStart, end: finalEnd };
  }

  return null;
};

const getDurationMinutes = (start, end) => {
  if (!start || !end) return 0;
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diff / 60000));
};

const formatDuration = (minutes) => {
  if (!minutes) return "0 min";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
};

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

  const [refreshing, setRefreshing] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [reservationFilter, setReservationFilter] = useState("All");

  const workDays = useMemo(() => getWorkWeekDays(weekStartDate), [weekStartDate]);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (rooms.length > 0) {
      loadRoomStatusesForSelectedDate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, selectedDate]);

  useEffect(() => {
    if (modalVisible && selectedRoom?.id) {
      loadReservationsForSelected();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

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

      if (modalVisible && selectedRoom?.id) {
        await loadReservationsForSelected();
      }
    } finally {
      setRefreshing(false);
    }
  };

  const loadRooms = async () => {
    try {
      const response = await roomService.getAllRooms();
      if (response?.success) {
        setRooms(response.data || []);
      } else {
        Alert.alert("Error", response?.message || "Failed to load rooms");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load rooms");
    }
  };

  const loadMyReservations = async () => {
    setLoadingMyReservations(true);
    try {
      const response = await roomService.getMyReservations();
      if (response?.success) {
        setMyReservations(response.data || []);
      } else {
        setMyReservations([]);
      }
    } catch (error) {
      setMyReservations([]);
    } finally {
      setLoadingMyReservations(false);
    }
  };

  const fetchReservationsForRoomAndDate = async (roomId, date) => {
    try {
      const res = await roomService.getReservationsForDay(roomId, date);
      return res?.success ? res.data || [] : [];
    } catch {
      return [];
    }
  };

  const loadRoomStatusesForSelectedDate = async () => {
    setLoadingRoomStatuses(true);
    try {
      const results = await Promise.all(
        rooms.map(async (room) => {
          const reservations = await fetchReservationsForRoomAndDate(
            room.id,
            selectedDate
          );
          return { roomId: room.id, reservations };
        })
      );

      const map = {};
      results.forEach((item) => {
        map[item.roomId] = item.reservations;
      });

      setRoomDayStatusMap(map);
    } finally {
      setLoadingRoomStatuses(false);
    }
  };

  const loadReservationsForSelected = async () => {
    if (!selectedRoom?.id) return;
    setLoadingReservations(true);
    try {
      const reservations = await fetchReservationsForRoomAndDate(
        selectedRoom.id,
        selectedDate
      );

      setDayReservations(reservations);

      const suggestion = findNextAvailableSlot(reservations, selectedDate, 60);
      if (suggestion) {
        setStartTime(suggestion.start);
        setEndTime(suggestion.end);
      }
    } catch {
      setDayReservations([]);
      Alert.alert("Error", "Failed to load reservations");
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
    setSelectedRoom(null);
    setModalVisible(false);
    setShowStartPicker(false);
    setShowEndPicker(false);
    setReserving(false);
  };

  const hasOverlap = (newStart, newEnd) => {
    return dayReservations.some((r) => {
      const existingStart = new Date(r.startDateTime || r.startDate || r.start);
      const existingEnd = new Date(r.endDateTime || r.endDate || r.end);
      return newStart < existingEnd && newEnd > existingStart;
    });
  };

  const handleOpenModal = async (room) => {
    setSelectedRoom(room);
    setModalVisible(true);

    const selected = parseDateKey(selectedDate);
    setStartTime(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 9, 0));
    setEndTime(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 10, 0));

    setLoadingReservations(true);
    try {
      const reservations = await fetchReservationsForRoomAndDate(room.id, selectedDate);
      setDayReservations(reservations);

      const suggestion = findNextAvailableSlot(reservations, selectedDate, 60);
      if (suggestion) {
        setStartTime(suggestion.start);
        setEndTime(suggestion.end);
      }
    } catch {
      setDayReservations([]);
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
      Alert.alert("Error", "Please select a room");
      return;
    }

    if (!startTime || !endTime || !purpose.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    const startDateTime = combineDateAndTime(selectedDate, startTime);
    const endDateTime = combineDateAndTime(selectedDate, endTime);

    if (endDateTime <= startDateTime) {
      Alert.alert("Error", "End time must be after start time");
      return;
    }

    if (hasOverlap(startDateTime, endDateTime)) {
      Alert.alert(
        "Not available",
        "This time overlaps an existing reservation. Choose another slot."
      );
      return;
    }

    setReserving(true);
    try {
      const response = await roomService.createReservation({
        roomId: selectedRoom.id,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        purpose: purpose.trim(),
      });

      if (response?.success) {
        Alert.alert("Success", "Room reservation submitted successfully");
        await Promise.all([
          loadReservationsForSelected(),
          loadMyReservations(),
          loadRoomStatusesForSelectedDate(),
        ]);
        resetModal();
      } else {
        Alert.alert("Error", response?.message || "Failed to reserve room");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to reserve room");
    } finally {
      setReserving(false);
    }
  };

  const getStatusStyle = (status) => {
    const value = String(status || "").toLowerCase();

    if (value === "pending") {
      return {
        badge: styles.statusPending,
        text: styles.statusPendingText,
        label: "Pending",
      };
    }

    if (value === "approved" || value === "active") {
      return {
        badge: styles.statusApproved,
        text: styles.statusApprovedText,
        label: "Approved",
      };
    }

    if (value === "rejected") {
      return {
        badge: styles.statusRejected,
        text: styles.statusRejectedText,
        label: "Rejected",
      };
    }

    if (value === "cancelled") {
      return {
        badge: styles.statusCancelled,
        text: styles.statusCancelledText,
        label: "Cancelled",
      };
    }

    return {
      badge: styles.statusDefault,
      text: styles.statusDefaultText,
      label: status || "Unknown",
    };
  };

  const getRoomAvailability = (roomId) => {
    const reservations = roomDayStatusMap[roomId] || [];

    if (loadingRoomStatuses) {
      return {
        label: "Checking...",
        badge: styles.roomStatusMuted,
        text: styles.roomStatusMutedText,
        border: styles.roomBorderMuted,
      };
    }

    if (reservations.length === 0) {
      return {
        label: "Free all day",
        badge: styles.roomStatusAvailable,
        text: styles.roomStatusAvailableText,
        border: styles.roomBorderAvailable,
      };
    }

    const now = new Date();
    const isSelectedToday = selectedDate === todayStr;

    if (isSelectedToday) {
      const busyNow = reservations.some((r) => {
        const start = new Date(r.startDateTime || r.startDate || r.start);
        const end = new Date(r.endDateTime || r.endDate || r.end);
        return now >= start && now <= end;
      });

      if (busyNow) {
        return {
          label: "Busy now",
          badge: styles.roomStatusBusy,
          text: styles.roomStatusBusyText,
          border: styles.roomBorderBusy,
        };
      }
    }

    return {
      label: "Partially booked",
      badge: styles.roomStatusBooked,
      text: styles.roomStatusBookedText,
      border: styles.roomBorderBooked,
    };
  };

  const selectedDateReadable = useMemo(() => {
    return parseDateKey(selectedDate).toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }, [selectedDate]);

  const selectedDayRoomSummary = useMemo(() => {
    let freeAllDay = 0;
    let partial = 0;

    rooms.forEach((room) => {
      const reservations = roomDayStatusMap[room.id] || [];
      if (reservations.length === 0) freeAllDay += 1;
      else partial += 1;
    });

    return { freeAllDay, partial };
  }, [rooms, roomDayStatusMap]);

  const filteredMyReservations = useMemo(() => {
    const now = new Date();

    const sorted = [...myReservations].sort(
      (a, b) =>
        new Date(b.startDateTime || b.startDate || b.start) -
        new Date(a.startDateTime || a.startDate || a.start)
    );

    if (reservationFilter === "Upcoming") {
      return sorted.filter(
        (reservation) =>
          new Date(
            reservation.endDateTime || reservation.endDate || reservation.end
          ) >= now
      );
    }

    if (reservationFilter === "Past") {
      return sorted.filter(
        (reservation) =>
          new Date(
            reservation.endDateTime || reservation.endDate || reservation.end
          ) < now
      );
    }

    return sorted;
  }, [myReservations, reservationFilter]);

  const durationMinutes =
    startTime && endTime
      ? getDurationMinutes(
          combineDateAndTime(selectedDate, startTime),
          combineDateAndTime(selectedDate, endTime)
        )
      : 0;

  const overlapWarning =
    startTime && endTime
      ? hasOverlap(
          combineDateAndTime(selectedDate, startTime),
          combineDateAndTime(selectedDate, endTime)
        )
      : false;

  const suggestedSlotText =
    startTime && endTime
      ? `Suggested slot: ${formatTime(startTime)} - ${formatTime(endTime)}`
      : "No free slot suggested for this date";

  return (
    <View style={styles.container}>
      <View style={styles.stickyHeader}>
        <Text style={styles.screenTitle}>Room Reservation</Text>
        <Text style={styles.screenSubtitle}>
          Choose a workday and reserve a meeting room
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.calendarCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.blockTitle}>Select a workday</Text>
            <Text style={styles.blockSubtitle}>
              Monday to Friday only
            </Text>
          </View>

          <View style={styles.weekHeaderRow}>
            <TouchableOpacity
              style={styles.weekNavButton}
              activeOpacity={0.85}
              onPress={() => {
                const prev = new Date(weekStartDate);
                prev.setDate(prev.getDate() - 7);
                setWeekStartDate(prev);

                const prevDays = getWorkWeekDays(prev);
                setSelectedDate(formatDateKey(prevDays[0]));
              }}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={colors.text}
              />
            </TouchableOpacity>

            <Text style={styles.weekHeaderText}>
              {workDays[0].toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}{" "}
              -{" "}
              {workDays[4].toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </Text>

            <TouchableOpacity
              style={styles.weekNavButton}
              activeOpacity={0.85}
              onPress={() => {
                const next = new Date(weekStartDate);
                next.setDate(next.getDate() + 7);
                setWeekStartDate(next);

                const nextDays = getWorkWeekDays(next);
                setSelectedDate(formatDateKey(nextDays[0]));
              }}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.workWeekRow}>
            {workDays.map((day) => {
              const isSelected = selectedDate === formatDateKey(day);
              const isToday = sameDateKey(day, today);

              return (
                <TouchableOpacity
                  key={formatDateKey(day)}
                  style={[
                    styles.workDayCard,
                    isSelected && styles.workDayCardSelected,
                  ]}
                  activeOpacity={0.88}
                  onPress={() => setSelectedDate(formatDateKey(day))}
                >
                  <Text
                    style={[
                      styles.workDayName,
                      isSelected && styles.workDayNameSelected,
                    ]}
                  >
                    {day.toLocaleDateString([], { weekday: "short" })}
                  </Text>

                  <Text
                    style={[
                      styles.workDayNumber,
                      isSelected && styles.workDayNumberSelected,
                    ]}
                  >
                    {day.getDate()}
                  </Text>

                  <Text
                    style={[
                      styles.workDayMonth,
                      isSelected && styles.workDayMonthSelected,
                    ]}
                  >
                    {day.toLocaleDateString([], { month: "short" })}
                  </Text>

                  {isToday && <View style={styles.todayDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.daySummaryCard}>
            <Text style={styles.daySummaryTitle}>{selectedDateReadable}</Text>
            <Text style={styles.daySummaryText}>
              {selectedDayRoomSummary.freeAllDay} free all day •{" "}
              {selectedDayRoomSummary.partial} partially booked
            </Text>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.blockTitle}>My reservations</Text>
            <Text style={styles.blockSubtitle}>Track your room bookings</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {MY_RESERVATION_FILTERS.map((filter) => {
              const selected = reservationFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterChip,
                    selected && styles.filterChipActive,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => setReservationFilter(filter)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected && styles.filterChipTextActive,
                    ]}
                  >
                    {filter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loadingMyReservations ? (
            <Text style={styles.muted}>Loading your reservations…</Text>
          ) : filteredMyReservations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No reservations found</Text>
              <Text style={styles.emptyText}>
                Your room bookings will appear here once created.
              </Text>
            </View>
          ) : (
            filteredMyReservations.map((reservation) => {
              const statusStyle = getStatusStyle(reservation.status);

              return (
                <View key={reservation.id} style={styles.myReservationCard}>
                  <View style={styles.myReservationHeader}>
                    <View style={styles.myReservationMain}>
                      <Text style={styles.myReservationRoom}>
                        {reservation.roomName || "Room"}
                      </Text>
                      <Text style={styles.myReservationDate}>
                        {formatReservationDate(
                          reservation.startDateTime,
                          reservation.endDateTime
                        )}
                      </Text>
                    </View>

                    <View style={[styles.statusBadge, statusStyle.badge]}>
                      <Text style={[styles.statusText, statusStyle.text]}>
                        {statusStyle.label}
                      </Text>
                    </View>
                  </View>

                  {!!reservation.purpose && (
                    <View style={styles.infoPill}>
                      <Text style={styles.infoPillLabel}>Purpose</Text>
                      <Text style={styles.infoPillText}>
                        {reservation.purpose}
                      </Text>
                    </View>
                  )}

                  {!!reservation.managerComment && (
                    <View style={styles.commentBox}>
                      <Text style={styles.commentLabel}>Manager comment</Text>
                      <Text style={styles.commentText}>
                        {reservation.managerComment}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.blockTitle}>Available rooms</Text>
            <Text style={styles.blockSubtitle}>Tap a room to reserve it</Text>
          </View>

          <View style={styles.roomsList}>
            {rooms.map((room) => {
              const availability = getRoomAvailability(room.id);
              const reservationCount = (roomDayStatusMap[room.id] || []).length;

              return (
                <TouchableOpacity
                  key={room.id}
                  style={[styles.roomItem, availability.border]}
                  activeOpacity={0.88}
                  onPress={() => handleOpenModal(room)}
                >
                  <View style={styles.roomTopRow}>
                    <View style={styles.roomTitleWrap}>
                      <Text style={styles.roomName}>{room.name}</Text>
                      <Text style={styles.roomDetails}>
                        Floor {room.floor} • Capacity: {room.capacity}
                      </Text>
                    </View>

                    <View style={styles.roomArrowWrap}>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                  </View>

                  <View style={styles.roomMetaRow}>
                    <View style={[styles.roomStatusBadge, availability.badge]}>
                      <Text style={[styles.roomStatusText, availability.text]}>
                        {availability.label}
                      </Text>
                    </View>

                    <Text style={styles.roomBookingCount}>
                      {reservationCount}{" "}
                      {reservationCount === 1 ? "booking" : "bookings"} that day
                    </Text>
                  </View>

                  <View style={styles.roomFeatures}>
                    {room.hasProjector && (
                      <View style={styles.featureChip}>
                        <Ionicons
                          name="videocam-outline"
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={styles.featureText}>Projector</Text>
                      </View>
                    )}

                    {room.hasWhiteboard && (
                      <View style={styles.featureChip}>
                        <Ionicons
                          name="clipboard-outline"
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={styles.featureText}>Whiteboard</Text>
                      </View>
                    )}

                    {!room.hasProjector && !room.hasWhiteboard && (
                      <Text style={styles.featureMuted}>No extra equipment</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={resetModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.modalTitle}>
                Reserve {selectedRoom?.name}
              </Text>
              <Text style={styles.modalSubtitle}>{selectedDateReadable}</Text>


              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Reservations for this day
                </Text>

                {loadingReservations ? (
                  <Text style={styles.muted}>Loading…</Text>
                ) : dayReservations.length === 0 ? (
                  <View style={styles.emptyInlineCard}>
                    <Text style={styles.emptyInlineText}>
                      No reservations yet for this day.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.resList}>
                    {dayReservations
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(a.startDateTime || a.startDate || a.start) -
                          new Date(b.startDateTime || b.startDate || b.start)
                      )
                      .map((r) => (
                        <View key={r.id} style={styles.resItem}>
                          <Text style={styles.resTime}>
                            {formatRange(
                              r.startDateTime || r.startDate || r.start,
                              r.endDateTime || r.endDate || r.end
                            )}
                          </Text>
                          {!!r.purpose && (
                            <Text style={styles.resPurpose} numberOfLines={1}>
                              {r.purpose}
                            </Text>
                          )}
                        </View>
                      ))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Choose time</Text>

                <View style={styles.timeRow}>
                  <Pressable
                    style={styles.timeField}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <Text style={styles.timeText}>
                      {startTime ? formatTime(startTime) : "Start"}
                    </Text>
                    <Text style={styles.timeLabel}>Start time</Text>
                  </Pressable>

                  <Pressable
                    style={styles.timeField}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <Text style={styles.timeText}>
                      {endTime ? formatTime(endTime) : "End"}
                    </Text>
                    <Text style={styles.timeLabel}>End time</Text>
                  </Pressable>
                </View>

                <View style={styles.quickDurationRow}>
                  {QUICK_DURATIONS.map((item) => (
                    <TouchableOpacity
                      key={item.minutes}
                      style={styles.quickDurationChip}
                      activeOpacity={0.85}
                      onPress={() => applyQuickDuration(item.minutes)}
                    >
                      <Text style={styles.quickDurationChipText}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.helperInfoCard}>
                  <Text style={styles.helperInfoLabel}>Duration</Text>
                  <Text style={styles.helperInfoText}>
                    {formatDuration(durationMinutes)}
                  </Text>
                </View>

                {overlapWarning && (
                  <View style={styles.warningCard}>
                    <Text style={styles.warningLabel}>Overlap detected</Text>
                    <Text style={styles.warningText}>
                      This time conflicts with an existing reservation.
                    </Text>
                  </View>
                )}

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

                        if (e <= s) {
                          const newEnd = new Date(date);
                          newEnd.setMinutes(newEnd.getMinutes() + 30);
                          setEndTime(newEnd);
                        }
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
                      if (event.type === "dismissed") return;
                      setEndTime(date);
                    }}
                  />
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Purpose</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Team meeting"
                  placeholderTextColor={colors.placeholder}
                  value={purpose}
                  onChangeText={setPurpose}
                  multiline
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  activeOpacity={0.85}
                  onPress={resetModal}
                  disabled={reserving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.reserveButton]}
                  activeOpacity={0.9}
                  onPress={handleReserve}
                  disabled={reserving}
                >
                  <Text style={styles.buttonText}>
                    {reserving ? "Reserving..." : "Reserve"}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.tip}>
                Tip: choose a free slot or use the suggested one to avoid overlap.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors, spacing, borderRadius, typography, shadows) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    stickyHeader: {
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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

    contentContainer: {
      paddingBottom: spacing.xxxl,
    },

    sectionBlock: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
    },

    sectionHeader: {
      marginBottom: spacing.md,
    },

    blockTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    blockSubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    calendarCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },

    weekHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },

    weekNavButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },

    weekHeaderText: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },

    workWeekRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.sm,
    },

    workDayCard: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: "center",
      position: "relative",
    },

    workDayCardSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    workDayName: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      fontWeight: typography.semibold,
      marginBottom: 2,
    },

    workDayNameSelected: {
      color: colors.textOnPrimary,
    },

    workDayNumber: {
      fontSize: typography.lg,
      color: colors.text,
      fontWeight: typography.bold,
    },

    workDayNumberSelected: {
      color: colors.textOnPrimary,
    },

    workDayMonth: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },

    workDayMonthSelected: {
      color: colors.textOnPrimary,
    },

    todayDot: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 6,
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.success,
    },

    daySummaryCard: {
      marginTop: spacing.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },

    daySummaryTitle: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    daySummaryText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    filterRow: {
      paddingBottom: spacing.lg,
      gap: spacing.sm,
    },

    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },

    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    filterChipText: {
      fontSize: typography.sm,
      color: colors.text,
      fontWeight: typography.semibold,
    },

    filterChipTextActive: {
      color: colors.textOnPrimary,
    },

    roomsList: {
      paddingBottom: spacing.sm,
    },

    roomItem: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 5,
      ...shadows.sm,
    },

    roomBorderAvailable: {
      borderLeftColor: colors.success,
    },

    roomBorderBusy: {
      borderLeftColor: colors.error,
    },

    roomBorderBooked: {
      borderLeftColor: colors.warning,
    },

    roomBorderMuted: {
      borderLeftColor: colors.textSecondary,
    },

    roomTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },

    roomTitleWrap: {
      flex: 1,
      paddingRight: spacing.sm,
    },

    roomName: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    roomDetails: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    roomArrowWrap: {
      width: 34,
      height: 34,
      borderRadius: borderRadius.full,
      backgroundColor: colors.infoLight,
      alignItems: "center",
      justifyContent: "center",
    },

    roomMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },

    roomStatusBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 1,
      borderRadius: borderRadius.full,
    },

    roomStatusText: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
    },

    roomStatusAvailable: {
      backgroundColor: colors.successLight,
    },

    roomStatusAvailableText: {
      color: colors.success,
    },

    roomStatusBusy: {
      backgroundColor: colors.errorLight,
    },

    roomStatusBusyText: {
      color: colors.error,
    },

    roomStatusBooked: {
      backgroundColor: colors.warningLight,
    },

    roomStatusBookedText: {
      color: colors.warning,
    },

    roomStatusMuted: {
      backgroundColor: colors.surfaceMuted,
    },

    roomStatusMutedText: {
      color: colors.textSecondary,
    },

    roomBookingCount: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      fontWeight: typography.medium,
    },

    roomFeatures: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },

    featureChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.infoLight,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 1,
      borderRadius: borderRadius.sm,
    },

    featureText: {
      fontSize: typography.xs,
      color: colors.primary,
      fontWeight: typography.semibold,
    },

    featureMuted: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 1,
      borderRadius: borderRadius.sm,
      overflow: "hidden",
      fontWeight: typography.medium,
    },

    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.sm,
    },

    emptyTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    emptyText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    myReservationCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },

    myReservationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.sm,
    },

    myReservationMain: {
      flex: 1,
    },

    myReservationRoom: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    myReservationDate: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    infoPill: {
      marginTop: spacing.md,
      backgroundColor: colors.infoLight,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.info,
    },

    infoPillLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.info,
      marginBottom: spacing.xs,
    },

    infoPillText: {
      fontSize: typography.sm,
      color: colors.text,
    },

    statusBadge: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 1,
      borderRadius: borderRadius.full,
      alignSelf: "flex-start",
    },

    statusText: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
    },

    statusPending: {
      backgroundColor: colors.warningLight,
    },

    statusPendingText: {
      color: colors.warning,
    },

    statusApproved: {
      backgroundColor: colors.successLight,
    },

    statusApprovedText: {
      color: colors.success,
    },

    statusRejected: {
      backgroundColor: colors.errorLight,
    },

    statusRejectedText: {
      color: colors.error,
    },

    statusCancelled: {
      backgroundColor: colors.surfaceMuted,
    },

    statusCancelledText: {
      color: colors.textSecondary,
    },

    statusDefault: {
      backgroundColor: colors.errorLight,
    },

    statusDefaultText: {
      color: colors.primary,
    },

    commentBox: {
      marginTop: spacing.md,
      backgroundColor: colors.warningLight,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.warning,
    },

    commentLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.warning,
      marginBottom: spacing.xs,
    },

    commentText: {
      fontSize: typography.sm,
      color: colors.text,
      lineHeight: 19,
    },

    muted: {
      color: colors.textSecondary,
      fontSize: typography.sm,
    },

    modalContainer: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: colors.overlay,
    },

    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "92%",
      ...shadows.lg,
    },

    modalScrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },

    modalHandle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: borderRadius.full,
      backgroundColor: colors.border,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },

    modalTitle: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
      textAlign: "center",
    },

    modalSubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },

    suggestionCard: {
      backgroundColor: colors.successLight,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.success,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },

    suggestionLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.success,
      marginBottom: spacing.xs,
    },

    suggestionText: {
      fontSize: typography.sm,
      color: colors.text,
    },

    section: {
      marginBottom: spacing.lg,
    },

    sectionTitle: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      marginBottom: spacing.sm,
      color: colors.text,
    },

    emptyInlineCard: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },

    emptyInlineText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    resList: {
      gap: spacing.sm,
    },

    resItem: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      backgroundColor: colors.background,
    },

    resTime: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
    },

    resPurpose: {
      marginTop: spacing.xs,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    timeRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },

    timeField: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      backgroundColor: colors.background,
    },

    timeText: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
    },

    timeLabel: {
      marginTop: spacing.xs,
      fontSize: typography.xs,
      color: colors.textSecondary,
    },

    quickDurationRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.md,
    },

    quickDurationChip: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },

    quickDurationChipText: {
      fontSize: typography.xs,
      color: colors.text,
      fontWeight: typography.semibold,
    },

    helperInfoCard: {
      marginTop: spacing.md,
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.info,
      borderRadius: borderRadius.md,
      padding: spacing.md,
    },

    helperInfoLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.info,
      marginBottom: spacing.xs,
    },

    helperInfoText: {
      fontSize: typography.sm,
      color: colors.text,
    },

    warningCard: {
      marginTop: spacing.md,
      backgroundColor: colors.errorLight,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: borderRadius.md,
      padding: spacing.md,
    },

    warningLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.error,
      marginBottom: spacing.xs,
    },

    warningText: {
      fontSize: typography.sm,
      color: colors.text,
    },

    input: {
      minHeight: 90,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      fontSize: typography.base,
      color: colors.text,
      backgroundColor: colors.background,
    },

    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.xs,
    },

    button: {
      flex: 1,
      paddingVertical: spacing.md + 2,
      borderRadius: borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
    },

    cancelButton: {
      backgroundColor: colors.surfaceMuted,
      marginRight: spacing.sm,
    },

    reserveButton: {
      backgroundColor: colors.primary,
      marginLeft: spacing.sm,
      ...shadows.sm,
    },

    buttonText: {
      color: colors.textOnPrimary,
      fontSize: typography.base,
      fontWeight: typography.bold,
    },

    cancelButtonText: {
      color: colors.text,
      fontSize: typography.base,
      fontWeight: typography.bold,
    },

    tip: {
      marginTop: spacing.md,
      fontSize: typography.xs,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 18,
    },
  });