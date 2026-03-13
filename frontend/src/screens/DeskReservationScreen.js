import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { seatService } from "../services/api";
import { formatDate } from "../utils/helpers";
import { RefreshControl } from "react-native";
import { spacing, borderRadius, typography, shadows } from "../theme/theme";
import { Button, Card } from "../components";
import { useTheme } from "../context/ThemeContext";

const { width, height } = Dimensions.get("window");

const DeskReservationScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const selectedDate = useMemo(() => formatDate(new Date()), []);

  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);

  const [showReservedModal, setShowReservedModal] = useState(false);
  const [reservedSeatInfo, setReservedSeatInfo] = useState(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [myReservation, setMyReservation] = useState(null);

  const seatsByTable = seats.reduce((acc, seat) => {
    if (!acc[seat.officeTableId]) acc[seat.officeTableId] = [];
    acc[seat.officeTableId].push(seat);
    return acc;
  }, {});

  const onRefresh = async () => {
    setRefreshing(true);
    await handleRefresh();
    setRefreshing(false);
  };

  const fetchMyReservation = async () => {
    try {
      const response = await seatService.getMyTodayReservation();

      if (response.success && response.data) {
        setMyReservation(response.data);
      } else {
        setMyReservation(null);
      }
    } catch (error) {
      console.log("My reservation fetch error", error);
      setMyReservation(null);
    }
  };

  const mySeatLabel =
    myReservation?.seatLabel || myReservation?.SeatLabel || null;

  const hasMyReservation = !!mySeatLabel;

  const getTableBounds = (tableSeats) => {
    if (tableSeats.length === 0) return null;

    const minX = Math.min(...tableSeats.map((s) => s.positionX));
    const maxX = Math.max(...tableSeats.map((s) => s.positionX));
    const minY = Math.min(...tableSeats.map((s) => s.positionY));
    const maxY = Math.max(...tableSeats.map((s) => s.positionY));

    return {
      x: minX - 20,
      y: minY - 20,
      width: maxX - minX + 40,
      height: maxY - minY + 40,
    };
  };

  useEffect(() => {
    fetchSeatMap();
    fetchMyReservation();
  }, []);

  const fetchSeatMap = async () => {
    setLoading(true);
    try {
      const response = await seatService.getSeatMap(selectedDate);

      if (response.success) {
        const normalizedSeats = (response.data || []).map((seat) => ({
          id: seat.id || seat.Id,
          label: seat.label || seat.Label,
          positionX: seat.positionX ?? seat.PositionX,
          positionY: seat.positionY ?? seat.PositionY,
          officeTableId: seat.officeTableId ?? seat.OfficeTableId,
          isReserved: seat.isReserved ?? seat.IsReserved ?? false,
          reservedBy: seat.reservedBy || seat.ReservedBy,
        }));

        setSeats(normalizedSeats);
      } else {
        Alert.alert("Error", response.message || "Failed to load seat map");
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to load seat map");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchSeatMap(), fetchMyReservation()]);
  };

  const handleSeatPress = (seat) => {
    const isMySeat = mySeatLabel && seat.label === mySeatLabel;

    if (seat.isReserved) {
      const reservedBy = seat.reservedBy || {};

      setReservedSeatInfo({
        seatLabel: seat.label,
        reservedBy: {
          fullName: reservedBy.fullName || reservedBy.FullName || "Unknown",
          departmentName:
            reservedBy.departmentName || reservedBy.DepartmentName || "—",
        },
      });

      setShowReservedModal(true);
      return;
    }

    if (hasMyReservation && !isMySeat) {
      return;
    }

    setSelectedSeat(seat);
    setShowConfirmModal(true);
  };

  const handleConfirmReservation = async () => {
    if (!selectedSeat) return;

    setReserving(true);

    try {
      const response = await seatService.createReservation(
        selectedSeat.id,
        selectedDate,
      );

      if (response.success) {
        Alert.alert("Success", "Seat reserved successfully!", [
          {
            text: "OK",
            onPress: async () => {
              setShowConfirmModal(false);
              setSelectedSeat(null);
              await fetchSeatMap();
              await fetchMyReservation();
            },
          },
        ]);
      } else {
        Alert.alert("Error", response.message || "Failed to reserve seat");
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to reserve seat");
    } finally {
      setReserving(false);
    }
  };

  const getSeatColor = (seat) => {
    const isMySeat = mySeatLabel && seat.label === mySeatLabel;

    if (isMySeat) return colors.seatMine;
    if (seat.isReserved) return colors.seatReserved;
    if (hasMyReservation) return colors.border;
    if (selectedSeat && selectedSeat.id === seat.id) return colors.seatSelected;

    return colors.seatAvailable;
  };

  const prettyToday = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dateButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      overflow: "hidden",
    },
    dateButtonText: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.textPrimary,
    },
    todayOnlyText: {
      marginTop: 2,
      fontSize: typography.xs,
      color: colors.textSecondary,
    },
    refreshButton: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    scrollView: {
      flex: 1,
    },
    mapContainer: {
      minHeight: height * 0.5,
      padding: spacing.xl,
    },
    tableGroup: {
      position: "relative",
      marginBottom: 40,
    },
    tableRectangle: {
      position: "absolute",
      backgroundColor: colors.borderLight,
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: colors.border,
    },
    seatCircle: {
      position: "absolute",
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.surface,
      ...shadows.sm,
    },
    seatLabel: {
      color: colors.textOnPrimary,
      fontSize: 11,
      fontWeight: typography.bold,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: spacing.md,
      fontSize: typography.sm,
      color: colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 80,
      gap: spacing.md,
    },
    emptyText: {
      fontSize: typography.base,
      color: colors.textSecondary,
    },
    legend: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    legendText: {
      fontSize: typography.xs,
      color: colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    infoModalContent: {
      width: Math.min(width * 0.88, 360),
      padding: spacing.xl,
      backgroundColor: colors.surface,
    },
    infoModalTitle: {
      fontSize: typography.lg,
      fontWeight: typography.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    infoRow: {
      marginBottom: spacing.md,
    },
    infoLabel: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: typography.base,
      fontWeight: typography.medium,
      color: colors.textPrimary,
    },
    modalButton: {
      marginTop: spacing.lg,
    },
    modalButtonsRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    modalButtonHalf: {
      flex: 1,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.dateButton}>
          <Ionicons name="today-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dateButtonText}>{prettyToday}</Text>
            <Text style={styles.todayOnlyText}>Today only</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={20} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading seat map…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.mapContainer}
          showsVerticalScrollIndicator
          showsHorizontalScrollIndicator
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {Object.entries(seatsByTable).map(([tableId, tableSeats]) => {
            const bounds = getTableBounds(tableSeats);
            if (!bounds) return null;

            return (
              <View key={tableId} style={styles.tableGroup}>
                <View
                  style={[
                    styles.tableRectangle,
                    {
                      left: bounds.x,
                      top: bounds.y,
                      width: bounds.width,
                      height: bounds.height,
                    },
                  ]}
                />
                {tableSeats.map((seat) => (
                  <TouchableOpacity
                    key={seat.id}
                    style={[
                      styles.seatCircle,
                      {
                        left: seat.positionX - 14,
                        top: seat.positionY - 14,
                        backgroundColor: getSeatColor(seat),
                        opacity:
                          hasMyReservation &&
                          !seat.isReserved &&
                          seat.label !== mySeatLabel
                            ? 0.45
                            : 1,
                      },
                    ]}
                    onPress={() => handleSeatPress(seat)}
                    activeOpacity={
                      hasMyReservation &&
                      !seat.isReserved &&
                      seat.label !== mySeatLabel
                        ? 1
                        : 0.8
                    }
                  >
                    <Text style={styles.seatLabel}>{seat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}

          {seats.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="grid-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyText}>No seats configured</Text>
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.seatMine }]}
          />
          <Text style={styles.legendText}>Your seat</Text>
        </View>

        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: colors.seatAvailable },
            ]}
          />
          <Text style={styles.legendText}>Available</Text>
        </View>

        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.seatReserved }]}
          />
          <Text style={styles.legendText}>Reserved</Text>
        </View>

        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.seatSelected }]}
          />
          <Text style={styles.legendText}>Selected</Text>
        </View>
      </View>

      <Modal
        visible={showReservedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReservedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.infoModalContent}>
            <Text style={styles.infoModalTitle}>Seat reserved</Text>

            {reservedSeatInfo && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Seat</Text>
                  <Text style={styles.infoValue}>
                    {reservedSeatInfo.seatLabel}
                  </Text>
                </View>

                {reservedSeatInfo.reservedBy && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Reserved by</Text>
                      <Text style={styles.infoValue}>
                        {reservedSeatInfo.reservedBy.fullName}
                      </Text>
                    </View>

                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Department</Text>
                      <Text style={styles.infoValue}>
                        {reservedSeatInfo.reservedBy.departmentName}
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}

            <Button
              title="Close"
              variant="secondary"
              onPress={() => setShowReservedModal(false)}
              style={styles.modalButton}
            />
          </Card>
        </View>
      </Modal>

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowConfirmModal(false);
          setSelectedSeat(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.infoModalContent}>
            <Text style={styles.infoModalTitle}>Confirm reservation</Text>

            {selectedSeat && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Seat</Text>
                  <Text style={styles.infoValue}>{selectedSeat.label}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date</Text>
                  <Text style={styles.infoValue}>
                    {new Date().toLocaleDateString()}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setShowConfirmModal(false);
                  setSelectedSeat(null);
                }}
                disabled={reserving}
                style={styles.modalButtonHalf}
              />

              <Button
                title={reserving ? "" : "Confirm"}
                onPress={handleConfirmReservation}
                loading={reserving}
                disabled={reserving}
                style={styles.modalButtonHalf}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
};

export default DeskReservationScreen;
