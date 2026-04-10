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
  Platform,
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

const createStyles = (colors, spacing, borderRadius, typography, shadows) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ── Header ──────────────────────────────────────────────
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flex: 1,
    },
    headerDate: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
    },
    headerBadge: {
      alignSelf: "flex-start",
      marginTop: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    headerBadgeText: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.textOnPrimary,
      letterSpacing: 0.5,
    },
    refreshBtn: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    // ── Status card ─────────────────────────────────────────
    statusCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    statusCardBooked: {
      backgroundColor: colors.successLight,
      borderColor: colors.success,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    statusIconWrap: {
      width: 38,
      height: 38,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    statusTextWrap: {
      flex: 1,
    },
    statusTitle: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    statusSeat: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.success,
    },
    statusHint: {
      marginTop: 2,
      fontSize: typography.xs,
      color: colors.textSecondary,
    },
    cancelBtn: {
      marginTop: spacing.sm,
      alignSelf: "flex-start",
    },

    // ── Map ─────────────────────────────────────────────────
    scrollView: {
      flex: 1,
    },
    mapContainer: {
      padding: spacing.lg,
      paddingBottom: 120,
      gap: spacing.lg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 80,
      gap: spacing.sm,
    },
    emptyText: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
    },
    emptyHint: {
      fontSize: typography.sm,
      color: colors.textMuted,
      textAlign: "center",
      paddingHorizontal: spacing.xl,
    },

    // ── Table card ──────────────────────────────────────────
    tableCard: {
      padding: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tableHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    tableTitle: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
      letterSpacing: 0.3,
    },
    tableSubtitle: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 3,
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
      minWidth: Math.min(width * 0.28, 112),
    },
    tableVisual: {
      width: Math.min(width * 0.28, 112),
      backgroundColor: colors.surfaceMuted,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      overflow: "hidden",
      ...shadows.sm,
    },
    tableVisualLarge: { minHeight: 280 },
    tableVisualMedium: { minHeight: 220 },
    tableInnerLine: {
      position: "absolute",
      top: 16,
      bottom: 16,
      width: 3,
      borderRadius: 999,
      backgroundColor: colors.border,
      opacity: 0.6,
    },
    tableVisualText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
      letterSpacing: 0.3,
    },
    seatColumn: {
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 2,
    },

    // ── Seat ────────────────────────────────────────────────
    seatBox: {
      width: 56,
      height: 50,
      borderRadius: borderRadius.md,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: "transparent",
      ...shadows.sm,
    },
    seatLabel: {
      color: colors.textOnPrimary,
      fontSize: 11,
      fontWeight: typography.bold,
      marginTop: 2,
    },
    endSeatContainer: {
      marginTop: spacing.md,
      alignItems: "center",
    },

    // ── Legend ──────────────────────────────────────────────
    legend: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.lg,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: typography.xs,
      color: colors.textSecondary,
    },

    // ── Modal ───────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    infoModalContent: {
      width: Math.min(width * 0.88, 340),
      padding: spacing.xl,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      ...shadows.lg,
    },
    infoModalTitle: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    infoModalSeat: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    infoRow: {
      marginBottom: spacing.sm,
    },
    infoLabel: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    modalButton: {
      marginTop: spacing.lg,
    },

    // ── Action panel ────────────────────────────────────────
    actionPanel: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxxl ?? spacing.xl,
      ...shadows.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    actionPanelLeft: {
      flex: 1,
    },
    actionPanelTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
    },
    actionPanelSubtitle: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    actionPanelButton: {
      marginLeft: spacing.lg,
    },
  });

const DeskScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
  );

  const selectedDate = useMemo(() => formatDate(new Date()), []);

  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMyReservation, setLoadingMyReservation] = useState(true);
  const [reservingSeatId, setReservingSeatId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const [showReservedModal, setShowReservedModal] = useState(false);
  const [reservedSeatInfo, setReservedSeatInfo] = useState(null);
  const [selectedAvailableSeat, setSelectedAvailableSeat] = useState(null);

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
      setMyReservation(response?.success && raw ? raw : null);
    } catch {
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
          "Couldn't load map",
          response.message || "Pull down to try again.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Couldn't load map",
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
  const hasMyReservation = !!mySeatLabel;

  const prettyToday = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    [],
  );

  const seatsByTable = useMemo(() => {
    const grouped = seats.reduce((acc, seat) => {
      if (!acc[seat.officeTableId]) acc[seat.officeTableId] = [];
      acc[seat.officeTableId].push(seat);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([tableId, tableSeats], index) => {
        const sortedSeats = [...tableSeats].sort((a, b) => {
          const n = (l) => {
            const m = String(l).match(/\d+/);
            return m ? parseInt(m[0], 10) : 999;
          };
          return n(a.label) - n(b.label);
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
    if (!seat) return;
    const isMySeat = mySeatLabel && seat.label === mySeatLabel;

    if (isMySeat) {
      Alert.alert("Your seat", `You have seat ${seat.label} for today.`);
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
        "Already booked",
        `You have seat ${mySeatLabel}. Cancel it first.`,
      );
      return;
    }

    setSelectedAvailableSeat(
      selectedAvailableSeat?.id === seat.id ? null : seat,
    );
  };

  const confirmSeatReservation = async () => {
    if (!selectedAvailableSeat) return;
    setReservingSeatId(selectedAvailableSeat.id);
    try {
      const response = await seatService.createReservation(
        selectedAvailableSeat.id,
        selectedDate,
      );
      if (response.success) {
        await Promise.all([fetchSeatMap(), fetchMyReservation()]);
        setSelectedAvailableSeat(null);
        Alert.alert(
          "Reserved!",
          `Seat ${selectedAvailableSeat.label} is yours today.`,
        );
      } else {
        Alert.alert(
          "Couldn't reserve",
          response.message || "That seat may have just been taken.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Couldn't reserve",
        getErrorMessage(error, "Please try again."),
      );
    } finally {
      setReservingSeatId(null);
    }
  };

  const handleCancelReservation = () => {
    if (!hasMyReservation) return;
    Alert.alert(
      "Cancel reservation?",
      `Release seat ${mySeatLabel} for today?`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel",
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
      } else {
        Alert.alert("Couldn't cancel", response?.message || "Try again.");
      }
    } catch (error) {
      Alert.alert(
        "Couldn't cancel",
        getErrorMessage(error, "Something went wrong."),
      );
    } finally {
      setCancelling(false);
    }
  };

  const getSeatColor = (seat) => {
    const isMySeat = mySeatLabel && seat.label === mySeatLabel;
    const isSelected = selectedAvailableSeat?.id === seat.id;
    const isLoadingThisSeat = reservingSeatId === seat.id;

    if (isMySeat) return colors.seatMine;
    if (isLoadingThisSeat || isSelected) return colors.seatSelected;
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
    const isLoadingThisSeat = reservingSeatId === seat.id;
    const isDisabled =
      cancelling ||
      !!reservingSeatId ||
      (hasMyReservation && !seat.isReserved && !isMySeat);
    const isSelected = selectedAvailableSeat?.id === seat.id;

    return (
      <TouchableOpacity
        key={seat.id}
        style={[
          styles.seatBox,
          {
            backgroundColor: getSeatColor(seat),
            opacity: isDisabled && !isMySeat && !isLoadingThisSeat ? 0.4 : 1,
            borderColor: isSelected ? colors.textOnPrimary : "transparent",
            borderWidth: isSelected ? 2 : 1.5,
            transform: [{ scale: isSelected ? 1.05 : 1 }],
          },
        ]}
        onPress={() => handleSeatPress(seat)}
        disabled={isDisabled && !seat.isReserved && !isMySeat}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Seat ${seat.label}${seat.isReserved ? ", taken" : isMySeat ? ", your seat" : ", available"}`}
      >
        {isLoadingThisSeat ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <>
            <Ionicons
              name={
                isMySeat
                  ? "checkmark-circle"
                  : seat.isReserved
                    ? "lock-closed"
                    : "desktop-outline"
              }
              size={14}
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerDate}>{prettyToday}</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>TODAY ONLY</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          disabled={loading || refreshing}
          accessibilityLabel="Refresh seat map"
        >
          <Ionicons
            name="refresh"
            size={20}
            color={loading || refreshing ? colors.textMuted : colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Status card */}
      <Card
        style={[
          styles.statusCard,
          hasMyReservation && !loadingMyReservation && styles.statusCardBooked,
        ]}
      >
        {loadingMyReservation ? (
          <View style={styles.statusRow}>
            <View style={styles.statusIconWrap}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
            <Text style={styles.statusHint}>Checking your booking…</Text>
          </View>
        ) : hasMyReservation ? (
          <View style={styles.statusRow}>
            <View style={[styles.statusIconWrap, styles.statusIconSuccess]}>
              <Ionicons name="checkmark" size={18} color={colors.success} />
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle}>
                Seat {mySeatLabel} reserved
              </Text>
              <Text style={styles.statusHint}>Today · confirmed</Text>
            </View>
            <Button
              title="Release"
              variant="danger-outline"
              onPress={handleCancelReservation}
              loading={cancelling}
              disabled={cancelling}
            />
          </View>
        ) : (
          <View style={styles.statusRow}>
            <View style={styles.statusIconWrap}>
              <Ionicons
                name="desktop-outline"
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle}>No desk booked</Text>
              <Text style={styles.statusHint}>Tap a green seat to reserve</Text>
            </View>
          </View>
        )}
      </Card>

      {/* Map */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.mapContainer}
          showsVerticalScrollIndicator={false}
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
                size={40}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>No seats available</Text>
              <Text style={styles.emptyHint}>
                Pull to refresh or try again later.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: colors.seatMine, label: "Yours" },
          { color: colors.seatAvailable, label: "Free" },
          { color: colors.seatReserved, label: "Taken" },
          { color: colors.border, label: "N/A" },
        ].map(({ color, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Reserved seat modal */}
      <Modal
        visible={showReservedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReservedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.infoModalContent}>
            <Text style={styles.infoModalTitle}>Seat taken</Text>
            {reservedSeatInfo && (
              <>
                <Text style={styles.infoModalSeat}>
                  Seat {reservedSeatInfo.seatLabel}
                </Text>
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
            <Button
              title="OK"
              variant="secondary"
              onPress={() => setShowReservedModal(false)}
              style={styles.modalButton}
            />
          </Card>
        </View>
      </Modal>

      {/* Action panel */}
      {selectedAvailableSeat && (
        <View style={styles.actionPanel}>
          <View style={styles.actionPanelLeft}>
            <Text style={styles.actionPanelTitle}>
              Seat {selectedAvailableSeat.label}
            </Text>
            <Text style={styles.actionPanelSubtitle}>
              Tap confirm to book for today
            </Text>
          </View>
          <Button
            title="Confirm"
            onPress={confirmSeatReservation}
            loading={!!reservingSeatId}
            disabled={!!reservingSeatId}
            style={styles.actionPanelButton}
          />
        </View>
      )}
    </View>
  );
};

export default DeskScreen;
