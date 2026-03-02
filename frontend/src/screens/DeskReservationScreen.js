import React, { useState, useEffect } from 'react';
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
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { seatService } from '../services/api';
import { formatDate } from '../utils/helpers';
import { colors, spacing, borderRadius, typography, shadows } from '../theme/theme';
import { Button, Card } from '../components';

const { width, height } = Dimensions.get('window');

const DeskReservationScreen = () => {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [showCalendar, setShowCalendar] = useState(false);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [showReservedModal, setShowReservedModal] = useState(false);
  const [reservedSeatInfo, setReservedSeatInfo] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [reserving, setReserving] = useState(false);

  const seatsByTable = seats.reduce((acc, seat) => {
    if (!acc[seat.officeTableId]) acc[seat.officeTableId] = [];
    acc[seat.officeTableId].push(seat);
    return acc;
  }, {});

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
  }, [selectedDate]);

  const fetchSeatMap = async () => {
    setLoading(true);
    try {
      const response = await seatService.getSeatMap(selectedDate);
      if (response.success) {
        const normalizedSeats = (response.data || []).map((seat) => ({
          id: seat.id || seat.Id,
          label: seat.label || seat.Label,
          positionX: seat.positionX || seat.PositionX,
          positionY: seat.positionY || seat.PositionY,
          officeTableId: seat.officeTableId || seat.OfficeTableId,
          isReserved: seat.isReserved ?? seat.IsReserved ?? false,
          reservedBy: seat.reservedBy || seat.ReservedBy,
        }));
        setSeats(normalizedSeats);
      } else {
        Alert.alert('Error', response.message || 'Failed to load seat map');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load seat map');
    } finally {
      setLoading(false);
    }
  };

  const handleSeatPress = (seat) => {
    if (seat.isReserved) {
      const reservedBy = seat.reservedBy || {};
      setReservedSeatInfo({
        seatLabel: seat.label,
        reservedBy: {
          fullName: reservedBy.fullName || reservedBy.FullName || 'Unknown',
          departmentName: reservedBy.departmentName || reservedBy.DepartmentName || '—',
        },
      });
      setShowReservedModal(true);
    } else {
      setSelectedSeat(seat);
      setShowConfirmModal(true);
    }
  };

  const handleConfirmReservation = async () => {
    if (!selectedSeat) return;
    setReserving(true);
    try {
      const response = await seatService.createReservation(selectedSeat.id, selectedDate);
      if (response.success) {
        Alert.alert('Success', 'Seat reserved successfully!', [
          {
            text: 'OK',
            onPress: () => {
              setShowConfirmModal(false);
              setSelectedSeat(null);
              fetchSeatMap();
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to reserve seat');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to reserve seat');
    } finally {
      setReserving(false);
    }
  };

  const getSeatColor = (seat) => {
    if (seat.isReserved) return colors.seatReserved;
    if (selectedSeat && selectedSeat.id === seat.id) return colors.seatSelected;
    return colors.seatAvailable;
  };

  const minDate = formatDate(new Date());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.dateButton}
          onPress={() => setShowCalendar(true)}
          android_ripple={{ color: colors.border }}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text style={styles.dateButtonText}>
            {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </Pressable>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchSeatMap}
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
                      },
                    ]}
                    onPress={() => handleSeatPress(seat)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.seatLabel}>{seat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
          {seats.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="grid-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No seats configured</Text>
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.seatAvailable }]} />
          <Text style={styles.legendText}>Available</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.seatReserved }]} />
          <Text style={styles.legendText}>Reserved</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.seatSelected }]} />
          <Text style={styles.legendText}>Selected</Text>
        </View>
      </View>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCalendar(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select date</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Calendar
              minDate={minDate}
              onDayPress={(day) => {
                setSelectedDate(day.dateString);
                setShowCalendar(false);
              }}
              markedDates={{
                [selectedDate]: {
                  selected: true,
                  selectedColor: colors.primary,
                },
              }}
              theme={{
                todayTextColor: colors.primary,
                arrowColor: colors.primary,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: colors.textOnPrimary,
                textDayFontWeight: typography.medium,
                textMonthFontWeight: typography.semibold,
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reserved info modal */}
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
                  <Text style={styles.infoValue}>{reservedSeatInfo.seatLabel}</Text>
                </View>
                {reservedSeatInfo.reservedBy && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Reserved by</Text>
                      <Text style={styles.infoValue}>{reservedSeatInfo.reservedBy.fullName}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Department</Text>
                      <Text style={styles.infoValue}>{reservedSeatInfo.reservedBy.departmentName}</Text>
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

      {/* Confirm reservation modal */}
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
                    {new Date(selectedDate).toLocaleDateString()}
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
                title={reserving ? '' : 'Confirm'}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  dateButtonText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: { flex: 1 },
  mapContainer: {
    minHeight: height * 0.5,
    padding: spacing.xl,
  },
  tableGroup: { position: 'relative', marginBottom: 40 },
  tableRectangle: {
    position: 'absolute',
    backgroundColor: colors.borderLight,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  seatCircle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: Math.min(width * 0.92, 400),
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  infoModalContent: {
    width: Math.min(width * 0.88, 360),
    padding: spacing.xl,
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
  modalButton: { marginTop: spacing.lg },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalButtonHalf: { flex: 1 },
});

export default DeskReservationScreen;
