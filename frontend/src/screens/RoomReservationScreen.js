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
} from "react-native";
import { Calendar } from "react-native-calendars";
import DateTimePicker from "@react-native-community/datetimepicker";
import roomService from "../services/api/roomService";
import { useTheme } from "../context/ThemeContext";

export default function RoomReservationScreen() {
  const { colors } = useTheme();

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
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

  useEffect(() => {
    loadRooms();
    loadMyReservations();
  }, []);

  useEffect(() => {
    if (modalVisible && selectedRoom?.id) {
      loadReservationsForSelected();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

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
  };

  const parseSelectedDate = () => {
    const [y, m, d] = selectedDate.split("-").map((x) => Number(x));
    return { y, m, d };
  };

  const combineDateAndTime = (dateStr, timeDateObj) => {
    const [y, m, d] = dateStr.split("-").map((x) => Number(x));
    const hh = timeDateObj.getHours();
    const mm = timeDateObj.getMinutes();
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  };

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

  const loadReservationsForSelected = async () => {
    if (!selectedRoom?.id) return;
    setLoadingReservations(true);
    try {
      const res = await roomService.getReservationsForDay(
        selectedRoom.id,
        selectedDate,
      );
      if (res?.success) {
        setDayReservations(res.data || []);
      } else {
        setDayReservations([]);
        Alert.alert("Error", res?.message || "Failed to load reservations");
      }
    } catch (error) {
      setDayReservations([]);
      Alert.alert("Error", "Failed to load reservations");
    } finally {
      setLoadingReservations(false);
    }
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

    const { y, m, d } = parseSelectedDate();
    setStartTime(new Date(y, m - 1, d, 9, 0));
    setEndTime(new Date(y, m - 1, d, 10, 0));

    setLoadingReservations(true);
    try {
      const res = await roomService.getReservationsForDay(
        room.id,
        selectedDate,
      );
      if (res?.success) {
        setDayReservations(res.data || []);
      } else {
        setDayReservations([]);
      }
    } catch {
      setDayReservations([]);
    } finally {
      setLoadingReservations(false);
    }
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
        "This time overlaps an existing reservation. Choose another slot.",
      );
      return;
    }

    try {
      const response = await roomService.createReservation({
        roomId: selectedRoom.id,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        purpose: purpose.trim(),
      });

      if (response?.success) {
        Alert.alert("Success", "Room reservation submitted successfully");
        await loadReservationsForSelected();
        await loadMyReservations();
        resetModal();
      } else {
        Alert.alert("Error", response?.message || "Failed to reserve room");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to reserve room");
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    sectionBlock: {
      paddingHorizontal: 16,
      paddingTop: 20,
    },

    blockTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 12,
      color: colors.textPrimary,
    },

    roomsList: {
      paddingBottom: 10,
    },

    roomItem: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },

    roomName: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },

    roomDetails: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 10,
    },

    roomFeatures: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },

    feature: {
      fontSize: 12,
      color: colors.primary,
      backgroundColor: "rgba(239,68,68,0.1)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      overflow: "hidden",
    },

    myReservationCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 15,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 6,
      elevation: 1,
    },

    myReservationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 8,
    },

    myReservationRoom: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    myReservationDate: {
      marginTop: 8,
      fontSize: 13,
      color: colors.textSecondary,
    },

    myReservationPurpose: {
      marginTop: 6,
      fontSize: 14,
      color: colors.textPrimary,
    },

    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      alignSelf: "flex-start",
    },

    statusText: {
      fontSize: 12,
      fontWeight: "700",
    },

    statusPending: {
      backgroundColor: "#FEF3C7",
    },

    statusPendingText: {
      color: "#B45309",
    },

    statusApproved: {
      backgroundColor: "#DCFCE7",
    },

    statusApprovedText: {
      color: "#166534",
    },

    statusRejected: {
      backgroundColor: "#FEE2E2",
    },

    statusRejectedText: {
      color: "#B91C1C",
    },

    statusCancelled: {
      backgroundColor: "#E5E7EB",
    },

    statusCancelledText: {
      color: "#374151",
    },

    statusDefault: {
      backgroundColor: "#FEE2E2",
    },

    statusDefaultText: {
      color: colors.primary,
    },

    commentBox: {
      marginTop: 10,
      backgroundColor: "#FFF7ED",
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: "#FED7AA",
    },

    commentLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: "#9A3412",
      marginBottom: 4,
    },

    commentText: {
      fontSize: 13,
      color: "#7C2D12",
    },

    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
      padding: 12,
    },

    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 20,
      width: "95%",
      maxHeight: "90%",
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 16,
      elevation: 6,
    },

    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 12,
      color: colors.textPrimary,
    },

    section: {
      marginBottom: 12,
    },

    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 6,
      color: colors.textPrimary,
    },

    muted: {
      color: colors.textSecondary,
      fontSize: 13,
    },

    calendarCard: {
      marginHorizontal: 16,
      marginTop: 16,
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 8,
      elevation: 2,
    },

    resList: {
      gap: 8,
    },

    resItem: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 10,
      backgroundColor: colors.background,
    },

    resTime: {
      fontWeight: "700",
      color: colors.textPrimary,
    },

    resPurpose: {
      marginTop: 2,
      color: colors.textSecondary,
    },

    timeRow: {
      flexDirection: "row",
      gap: 10,
    },

    timeField: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      backgroundColor: colors.background,
    },

    timeText: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    timeLabel: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textSecondary,
    },

    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 15,
      marginBottom: 12,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.background,
    },

    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
    },

    button: {
      flex: 1,
      padding: 15,
      borderRadius: 10,
      alignItems: "center",
      marginHorizontal: 5,
    },

    cancelButton: {
      backgroundColor: colors.borderLight,
    },

    reserveButton: {
      backgroundColor: colors.primary,
    },

    buttonText: {
      color: colors.textOnPrimary,
      fontSize: 15,
      fontWeight: "700",
    },

    tip: {
      marginTop: 10,
      fontSize: 12,
      color: colors.textSecondary,
    },
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.calendarCard}>
        <Text style={styles.blockTitle}>Select a date</Text>

        <Calendar
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={{
            [selectedDate]: {
              selected: true,
              selectedColor: colors.primary,
            },
          }}
          theme={{
            backgroundColor: colors.surface,
            calendarBackground: colors.surface,
            textSectionTitleColor: colors.textSecondary,
            dayTextColor: colors.textPrimary,
            textDisabledColor: colors.textTertiary,
            monthTextColor: colors.textPrimary,
            arrowColor: colors.primary,
            todayTextColor: colors.primary,
            selectedDayTextColor: colors.textOnPrimary,
          }}
        />
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.blockTitle}>My reservations</Text>

        {loadingMyReservations ? (
          <Text style={styles.muted}>Loading your reservations…</Text>
        ) : myReservations.length === 0 ? (
          <Text style={styles.muted}>You have no room reservations yet.</Text>
        ) : (
          myReservations
            .slice()
            .sort(
              (a, b) =>
                new Date(b.startDateTime || b.startDate || b.start) -
                new Date(a.startDateTime || a.startDate || a.start),
            )
            .map((reservation) => {
              const statusStyle = getStatusStyle(reservation.status);

              return (
                <View key={reservation.id} style={styles.myReservationCard}>
                  <View style={styles.myReservationHeader}>
                    <Text style={styles.myReservationRoom}>
                      {reservation.roomName || "Room"}
                    </Text>

                    <View style={[styles.statusBadge, statusStyle.badge]}>
                      <Text style={[styles.statusText, statusStyle.text]}>
                        {statusStyle.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.myReservationDate}>
                    {formatReservationDate(
                      reservation.startDateTime,
                      reservation.endDateTime,
                    )}
                  </Text>

                  {!!reservation.purpose && (
                    <Text style={styles.myReservationPurpose}>
                      Purpose: {reservation.purpose}
                    </Text>
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
        <Text style={styles.blockTitle}>Available rooms</Text>

        <View style={styles.roomsList}>
          {rooms.map((room) => (
            <TouchableOpacity
              key={room.id}
              style={styles.roomItem}
              onPress={() => handleOpenModal(room)}
            >
              <Text style={styles.roomName}>{room.name}</Text>
              <Text style={styles.roomDetails}>
                Floor {room.floor} • Capacity: {room.capacity}
              </Text>

              <View style={styles.roomFeatures}>
                {room.hasProjector && (
                  <Text style={styles.feature}>📽️ Projector</Text>
                )}
                {room.hasWhiteboard && (
                  <Text style={styles.feature}>📋 Whiteboard</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={resetModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Reserve {selectedRoom?.name} • {selectedDate}
            </Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reservations for this day</Text>
              {loadingReservations ? (
                <Text style={styles.muted}>Loading…</Text>
              ) : dayReservations.length === 0 ? (
                <Text style={styles.muted}>No reservations yet.</Text>
              ) : (
                <View style={styles.resList}>
                  {dayReservations
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(a.startDateTime || a.startDate || a.start) -
                        new Date(b.startDateTime || b.startDate || b.start),
                    )
                    .map((r) => (
                      <View key={r.id} style={styles.resItem}>
                        <Text style={styles.resTime}>
                          {formatRange(
                            r.startDateTime || r.startDate || r.start,
                            r.endDateTime || r.endDate || r.end,
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
                  <Text style={styles.timeLabel}>Start</Text>
                </Pressable>

                <Pressable
                  style={styles.timeField}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Text style={styles.timeText}>
                    {endTime ? formatTime(endTime) : "End"}
                  </Text>
                  <Text style={styles.timeLabel}>End</Text>
                </Pressable>
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

            <TextInput
              style={styles.input}
              placeholder="Purpose (e.g., Team meeting)"
              placeholderTextColor={colors.textTertiary}
              value={purpose}
              onChangeText={setPurpose}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={resetModal}
              >
                <Text
                  style={[styles.buttonText, { color: colors.textPrimary }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.reserveButton]}
                onPress={handleReserve}
              >
                <Text style={styles.buttonText}>Reserve</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.tip}>
              Tip: if reservation fails, it’s usually because backend also
              detects an overlap.
            </Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
