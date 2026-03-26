import React, { useState, useEffect, useMemo, useCallback } from "react";
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

const DeskReservationScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const selectedDate = useMemo(() => formatDate(new Date()), []);

  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMyReservation, setLoadingMyReservation] = useState(true);
  const [reservingSeatId, setReservingSeatId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const [showReservedModal, setShowReservedModal] = useState(false);
  const [reservedSeatInfo, setReservedSeatInfo] = useState(null);

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
    setLoadingMyReservation(true);
    try {
      const response = await seatService.getMyTodayReservation();
      const raw = response?.data ?? null;

      if (response?.success && raw) {
        setMyReservation(raw);
      } else {
        setMyReservation(null);
      }
    } catch (error) {
      console.log("My reservation fetch error", error);
      setMyReservation(null);
    } finally {
      setLoadingMyReservation(false);
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
        Alert.alert(
          "Couldn’t load map",
          response.message || "Pull down to try again.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Couldn’t load map",
        getErrorMessage(error, "Check your connection and pull to refresh."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchSeatMap(), fetchMyReservation()]);
  }, [selectedDate]);

  const mySeatLabel =
    myReservation?.seatLabel || myReservation?.SeatLabel || null;

  const myReservationId =
    myReservation?.reservationId ||
    myReservation?.ReservationId ||
    myReservation?.id ||
    myReservation?.Id ||
    null;

  const hasMyReservation = !!mySeatLabel;

  const prettyToday = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

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

  const handleReserveSeat = async (seat) => {
    if (!seat) return;

    const isMySeat = mySeatLabel && seat.label === mySeatLabel;

    if (isMySeat) {
      Alert.alert(
        "Your seat for today",
        `You already have seat ${seat.label} for today.`,
      );
      return;
    }

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

    if (hasMyReservation) {
      Alert.alert(
        "Already booked for today",
        `You already have seat ${mySeatLabel}. Cancel it first if you want another one.`,
      );
      return;
    }

    setReservingSeatId(seat.id);

    try {
      const response = await seatService.createReservation(seat.id, selectedDate);

      if (response.success) {
        await Promise.all([fetchSeatMap(), fetchMyReservation()]);
        Alert.alert(
          "Desk reserved",
          `Seat ${seat.label} is yours for today (${prettyToday}).`,
        );
      } else {
        Alert.alert(
          "Couldn’t reserve",
          response.message ||
            "That seat may have just been taken. Refresh and try another.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Couldn’t reserve",
        getErrorMessage(
          error,
          "That seat may be unavailable. Refresh and try again.",
        ),
      );
    } finally {
      setReservingSeatId(null);
    }
  };

  const handleCancelReservation = () => {
    if (!hasMyReservation) return;

    Alert.alert(
      "Cancel reservation?",
      `Do you want to cancel your seat ${mySeatLabel} for today?`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel reservation",
          style: "destructive",
          onPress: confirmCancelReservation,
        },
      ],
    );
  };

  const confirmCancelReservation = async () => {
    setCancelling(true);

    try {
      const response = await seatService.cancelMyTodayReservation();

      if (response?.success) {
        await Promise.all([fetchSeatMap(), fetchMyReservation()]);
        Alert.alert("Reservation cancelled", "Your desk reservation was cancelled.");
      } else {
        Alert.alert(
          "Couldn’t cancel",
          response?.message || "Unable to cancel your reservation right now.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Couldn’t cancel",
        getErrorMessage(error, "Something went wrong while cancelling."),
      );
    } finally {
      setCancelling(false);
    }
  };

  const getSeatColor = (seat) => {
    const isMySeat = mySeatLabel && seat.label === mySeatLabel;
    const isLoadingThisSeat = reservingSeatId === seat.id;

    if (isMySeat) return colors.seatMine;
    if (isLoadingThisSeat) return colors.seatSelected;
    if (seat.isReserved) return colors.seatReserved;
    if (hasMyReservation) return colors.border;

    return colors.seatAvailable;
  };

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
    const isDisabled =
      cancelling ||
      !!reservingSeatId ||
      (hasMyReservation && !seat.isReserved && !isMySeat);

    const isLoadingThisSeat = reservingSeatId === seat.id;

    return (
      <TouchableOpacity
        key={seat.id}
        style={[
          styles.seatBox,
          {
            backgroundColor: getSeatColor(seat),
            opacity: isDisabled && !isMySeat && !isLoadingThisSeat ? 0.45 : 1,
            borderColor: isLoadingThisSeat ? colors.textOnPrimary : colors.surface,
            borderWidth: isLoadingThisSeat ? 2 : 1.5,
          },
        ]}
        onPress={() => handleReserveSeat(seat)}
        disabled={isDisabled && !seat.isReserved && !isMySeat}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Seat ${seat.label}${
          seat.isReserved ? ", taken" : isMySeat ? ", your seat" : ", available"
        }`}
      >
        {isLoadingThisSeat ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <>
            <Ionicons
              name={seat.isReserved ? "lock-closed" : "desktop-outline"}
              size={13}
              color={colors.textOnPrimary}
            />
            <Text style={styles.seatLabel}>{seat.label}</Text>
          </>
        )}
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
    dateBlock: {
      flex: 1,
    },
    dateButtonText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    todayBadge: {
      alignSelf: "flex-start",
      marginTop: spacing.xs,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    todayBadgeText: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.textOnPrimary,
    },
    todayRules: {
      marginTop: 4,
      fontSize: typography.xs,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    refreshBtn: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
    },
    statusIconWrap: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    statusTitle: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    statusBody: {
      marginTop: 2,
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    statusSuccess: {
      backgroundColor: colors.successLight,
      borderColor: colors.success,
    },
    statusActions: {
      marginTop: spacing.md,
      alignItems: "flex-start",
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
      paddingHorizontal: spacing.xl,
    },
    loadingText: {
      marginTop: spacing.md,
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
    },
    loadingHint: {
      marginTop: spacing.sm,
      fontSize: typography.xs,
      color: colors.textMuted,
      textAlign: "center",
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
      textAlign: "center",
    },
    emptyHint: {
      fontSize: typography.sm,
      color: colors.textMuted,
      textAlign: "center",
      paddingHorizontal: spacing.lg,
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
      maxWidth: "48%",
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    legendText: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      flexShrink: 1,
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
      marginBottom: spacing.sm,
    },
    infoModalSubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
      lineHeight: 20,
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
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateButtonText}>{prettyToday}</Text>
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>TODAY ONLY</Text>
          </View>
          <Text style={styles.todayRules}>
            Tap an available seat to reserve it instantly. One desk per person per day.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          disabled={loading || refreshing}
          accessibilityLabel="Refresh seat map"
        >
          <Ionicons
            name="refresh"
            size={22}
            color={loading || refreshing ? colors.textMuted : colors.primary}
          />
        </TouchableOpacity>
      </View>

      <Card
        style={[
          styles.statusCard,
          hasMyReservation && !loadingMyReservation && styles.statusSuccess,
        ]}
      >
        {loadingMyReservation ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>Checking your booking…</Text>
              <Text style={styles.statusBody}>
                Looking up whether you already have a desk for today.
              </Text>
            </View>
          </View>
        ) : hasMyReservation ? (
          <>
            <View style={styles.statusRow}>
              <View style={styles.statusIconWrap}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>You&apos;re booked for today</Text>
                <Text style={styles.statusBody}>
                  Your desk is seat <Text style={{ fontWeight: "700" }}>{mySeatLabel}</Text>.
                  You can cancel this reservation if needed.
                </Text>
              </View>
            </View>

            <View style={styles.statusActions}>
              <Button
                title="Cancel reservation"
                variant="secondary"
                onPress={handleCancelReservation}
                loading={cancelling}
                disabled={cancelling}
              />
            </View>
          </>
        ) : (
          <View style={styles.statusRow}>
            <View style={styles.statusIconWrap}>
              <Ionicons
                name="desktop-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>No desk yet today</Text>
              <Text style={styles.statusBody}>
                Tap any green available seat to reserve it instantly. Red seats are already taken.
              </Text>
            </View>
          </View>
        )}
      </Card>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading today&apos;s seat map…</Text>
          <Text style={styles.loadingHint}>
            This can take a moment on a slow connection.
          </Text>
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
              <Text style={styles.emptyText}>No seats on the map</Text>
              <Text style={styles.emptyHint}>
                There may be no layout configured for today, or the list is empty.
                Pull to refresh or try again later.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.seatMine }]} />
          <Text style={styles.legendText}>Your seat</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.seatAvailable }]} />
          <Text style={styles.legendText}>Available</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.seatReserved }]} />
          <Text style={styles.legendText}>Taken</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
          <Text style={styles.legendText}>Unavailable</Text>
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
            <Text style={styles.infoModalTitle}>Seat not available</Text>
            <Text style={styles.infoModalSubtitle}>
              Someone else has this seat for today. One person per seat per day.
            </Text>

            {reservedSeatInfo && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Seat</Text>
                  <Text style={styles.infoValue}>{reservedSeatInfo.seatLabel}</Text>
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
              title="OK"
              variant="secondary"
              onPress={() => setShowReservedModal(false)}
              style={styles.modalButton}
            />
          </Card>
        </View>
      </Modal>
    </View>
  );
};

export default DeskReservationScreen;