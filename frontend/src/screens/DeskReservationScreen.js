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
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { seatService } from "../services/api";
import { formatDate } from "../utils/helpers";
import { Button, Card } from "../components";
import { useTheme } from "../context/ThemeContext";

const { width } = Dimensions.get("window");

const DeskReservationScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const selectedDate = useMemo(() => formatDate(new Date()), []);

  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);

  const [showReservedModal, setShowReservedModal] = useState(false);
  const [reservedSeatInfo, setReservedSeatInfo] = useState(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [myReservation, setMyReservation] = useState(null);

  useEffect(() => {
    fetchSeatMap();
    fetchMyReservation();
  }, []);

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

  const fetchSeatMap = async () => {
    setLoading(true);
    try {
      const response = await seatService.getSeatMap(selectedDate);

      if (response.success) {
        const normalizedSeats = (response.data || []).map((seat) => ({
          id: seat.id || seat.Id,
          label: seat.label || seat.Label,
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

  const mySeatLabel =
    myReservation?.seatLabel || myReservation?.SeatLabel || null;

  const hasMyReservation = !!mySeatLabel;

  const seatsByTable = useMemo(() => {
    const grouped = seats.reduce((acc, seat) => {
      if (!acc[seat.officeTableId]) acc[seat.officeTableId] = [];
      acc[seat.officeTableId].push(seat);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([tableId, tableSeats], index) => {
        const sortedSeats = [...tableSeats].sort((a, b) => {
          const getSeatNumber = (label) => {
            const match = String(label).match(/\d+/);
            return match ? parseInt(match[0], 10) : 999;
          };
          return getSeatNumber(a.label) - getSeatNumber(b.label);
        });

        return {
          tableId,
          tableName: `Table ${String.fromCharCode(65 + index)}`,
          seats: sortedSeats,
        };
      })
      .sort((a, b) => Number(a.tableId) - Number(b.tableId));
  }, [seats]);

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
    if (selectedSeat && selectedSeat.id === seat.id) return colors.seatSelected;
    if (seat.isReserved) return colors.seatReserved;
    if (hasMyReservation) return colors.border;

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

  const getTableLayout = (tableSeats) => {
    const count = tableSeats.length;

    if (count === 11) {
      return {
        type: "eleven",
        leftSeats: tableSeats.slice(0, 5),
        rightSeats: tableSeats.slice(5, 10),
        endSeat: tableSeats[10],
      };
    }

    if (count === 8) {
      return {
        type: "eight",
        leftSeats: tableSeats.slice(0, 4),
        rightSeats: tableSeats.slice(4, 8),
      };
    }

    const middle = Math.ceil(count / 2);
    return {
      type: "generic",
      leftSeats: tableSeats.slice(0, middle),
      rightSeats: tableSeats.slice(middle),
    };
  };

  const renderSeat = (seat) => {
    const isMySeat = mySeatLabel && seat.label === mySeatLabel;
    const isSelected = selectedSeat?.id === seat.id;
    const isDisabled = hasMyReservation && !seat.isReserved && !isMySeat;

    return (
      <TouchableOpacity
        key={seat.id}
        style={[
          styles.seatBox,
          {
            backgroundColor: getSeatColor(seat),
            opacity: isDisabled ? 0.45 : 1,
            transform: isSelected ? [{ scale: 1.07 }] : [{ scale: 1 }],
            borderColor: isSelected ? colors.textOnPrimary : colors.surface,
            borderWidth: isSelected ? 2 : 1.5,
          },
        ]}
        onPress={() => handleSeatPress(seat)}
        activeOpacity={isDisabled ? 1 : 0.85}
      >
        <Ionicons
          name={seat.isReserved ? "lock-closed" : "desktop-outline"}
          size={13}
          color={colors.textOnPrimary}
        />
        <Text style={styles.seatLabel}>{seat.label}</Text>
      </TouchableOpacity>
    );
  };

  const renderSeatColumn = (seatList) => (
    <View style={styles.seatColumn}>
      {seatList.map((seat) => renderSeat(seat))}
    </View>
  );

  const renderTable = (table) => {
    const layout = getTableLayout(table.seats);
    const isEleven = layout.type === "eleven";

    return (
      <Card key={table.tableId} style={styles.tableCard}>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.tableTitle}>{table.tableName}</Text>
          <Text style={styles.tableSubtitle}>{table.seats.length} seats</Text>
        </View>

        <View style={styles.tableWrap}>
          <View style={styles.tableRow}>
            {renderSeatColumn(layout.leftSeats)}

            <View style={styles.tableCenter}>
              <View
                style={[
                  styles.tableVisual,
                  isEleven ? styles.tableVisualLarge : styles.tableVisualMedium,
                ]}
              >
                <View style={styles.tableInnerSurface} />
                <View style={styles.tableInnerLine} />
                <Text style={styles.tableVisualText}>{table.tableName}</Text>
              </View>
            </View>

            {renderSeatColumn(layout.rightSeats)}
          </View>

          {layout.type === "eleven" && layout.endSeat && (
            <View style={styles.endSeatContainer}>
              {renderSeat(layout.endSeat)}
            </View>
          )}
        </View>
      </Card>
    );
  };

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
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.md,
      overflow: "hidden",
    },
    dateButtonText: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.text,
    },
    todayOnlyText: {
      marginTop: 2,
      fontSize: typography.xs,
      color: colors.textSecondary,
    },
    scrollView: {
      flex: 1,
    },
    mapContainer: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.lg,
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
    tableCard: {
      padding: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tableHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    tableTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    tableSubtitle: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    tableWrap: {
      alignItems: "center",
    },
    tableRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "stretch",
      gap: spacing.md,
      width: "100%",
    },
    tableCenter: {
      justifyContent: "center",
      alignItems: "center",
      minWidth: Math.min(width * 0.32, 128),
    },

    tableVisual: {
      width: Math.min(width * 0.32, 128),
      backgroundColor: colors.surfaceMuted,
      borderRadius: 28,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      position: "relative",
      overflow: "hidden",
      ...shadows.sm,
    },

    tableVisualLarge: {
      minHeight: 280,
    },

    tableVisualMedium: {
      minHeight: 220,
    },

    tableInnerSurface: {
      position: "absolute",
      top: 10,
      bottom: 10,
      left: 10,
      right: 10,
      borderRadius: 22,
      backgroundColor: colors.surface,
      opacity: 0.18,
    },

    tableInnerLine: {
      position: "absolute",
      top: 18,
      bottom: 18,
      width: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
      opacity: 0.75,
    },

    tableVisualText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
      textAlign: "center",
      letterSpacing: 0.3,
    },
    seatBox: {
      width: 60,
      height: 54,
      borderRadius: borderRadius.lg,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.surface,
      ...shadows.sm,
    },

    seatLabel: {
      color: colors.textOnPrimary,
      fontSize: 12,
      fontWeight: typography.bold,
      marginTop: 2,
    },

    seatColumn: {
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 2,
    },
    endSeatContainer: {
      marginTop: spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    selectionCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: borderRadius.xl,
    },
    selectionTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    selectionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      flex: 1,
    },
    selectedSeatBadge: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.lg,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.seatSelected,
    },
    selectionInfo: {
      flex: 1,
    },
    selectionTitle: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    selectionValue: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    selectionSubtext: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.md,
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
      backgroundColor: colors.overlay,
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
      color: colors.text,
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
      color: colors.text,
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
      </View>

      {selectedSeat && (
        <Card style={styles.selectionCard}>
          <View style={styles.selectionTopRow}>
            <View style={styles.selectionLeft}>
              <View style={styles.selectedSeatBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={colors.textOnPrimary}
                />
              </View>

              <View style={styles.selectionInfo}>
                <Text style={styles.selectionTitle}>Selected seat</Text>
                <Text style={styles.selectionValue}>{selectedSeat.label}</Text>
                <Text style={styles.selectionSubtext}>
                  Tap reserve to confirm your booking
                </Text>
              </View>
            </View>

            <Button
              title="Reserve"
              onPress={() => setShowConfirmModal(true)}
              disabled={reserving}
            />
          </View>
        </Card>
      )}

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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {seatsByTable.map((table) => renderTable(table))}

          {seats.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="grid-outline"
                size={48}
                color={colors.textMuted}
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
