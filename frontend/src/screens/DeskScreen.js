import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Platform,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { seatService } from "../services/api";
import { formatDate } from "../utils/helpers";
import { Button, Card } from "../components";
import { useTheme } from "../context/ThemeContext";
import { useE2eMode } from "../context/E2eModeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import FeedbackModal from "../components/FeedbackModal";
import { useFeedback } from "../hooks/useFeedback";

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

const createStyles = (
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
  insets,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

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
    e2eHiddenMarker: {
      width: 0,
      height: 0,
    },
    cancelBtn: {
      marginTop: spacing.sm,
      alignSelf: "flex-start",
    },

    scrollView: {
      flex: 1,
    },
    mapContainer: {
      padding: spacing.lg,
      paddingBottom: 220,
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

    legend: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.lg,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg + 4,
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

    actionPanel: {
      position: "absolute",
      bottom: 90 + (insets?.bottom ?? 0),
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
    scannerContainer: {
      flex: 1,
      backgroundColor: "#000",
    },
    scannerOverlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    scannerTitle: {
      position: "absolute",
      top: 70,
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
    scannerHint: {
      marginTop: spacing.lg,
      color: "#fff",
      fontSize: typography.sm,
      textAlign: "center",
    },
    closeScannerBtn: {
      position: "absolute",
      bottom: 50,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.65)",
    },
    closeScannerText: {
      color: "#fff",
      fontWeight: typography.bold,
    },
    e2eQrPanel: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.info,
      backgroundColor: colors.infoLight,
    },
    e2eQrTitle: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.info,
      marginBottom: spacing.sm,
    },
    e2eQrPresetButton: {
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    e2eQrPresetText: {
      fontSize: typography.sm,
      color: colors.text,
      fontWeight: typography.semibold,
    },
    e2eQrInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      backgroundColor: colors.surface,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    e2eQrActions: {
      marginTop: spacing.xs,
    },

    // ── Table selector ──────────────────────────────────────────────
    tableSelectorContainer: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tableSelectorTitle: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
    },
    tableSelectorList: {},
    tableSelectorListContent: {
      gap: spacing.sm,
    },
    tableOptionButton: {
      width: 82,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      gap: 4,
    },
    tableOptionButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tableOptionButtonMine: {
      borderColor: colors.success,
      borderWidth: 1.5,
    },
    tableOptionDots: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 3,
      justifyContent: "center",
      width: 46,
      minHeight: 16,
    },
    tableOptionDot: {
      width: 7,
      height: 7,
      borderRadius: 99,
    },
    tableOptionDotMore: {
      fontSize: 9,
      color: colors.textMuted,
      alignSelf: "center",
      marginLeft: 2,
    },
    tableOptionName: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.text,
    },
    tableOptionNameActive: {
      color: colors.textOnPrimary,
    },
    tableOptionAvailability: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    tableOptionAvailabilityActive: {
      color: colors.textOnPrimary,
      opacity: 0.85,
    },
  });

const DeskScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const isE2e = useE2eMode();
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { feedback, showFeedback, hideFeedback } = useFeedback();

  const styles = useMemo(
    () =>
      createStyles(colors, spacing, borderRadius, typography, shadows, insets),
    [colors, spacing, borderRadius, typography, shadows, insets],
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

  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [e2eQrValue, setE2eQrValue] = useState("");
  const [e2eQrPanelVisible, setE2eQrPanelVisible] = useState(false);

  const [selectedTableId, setSelectedTableId] = useState(null);
  const tableSelectorRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────
  // Feedback helper
  // ─────────────────────────────────────────────────────────────────
  const showFeedbackAlert = useCallback(
    (title, message, buttons = null) => {
      const buttonList = Array.isArray(buttons) ? buttons : [];
      const destructiveButton = buttonList.find(
        (button) => button?.style === "destructive",
      );
      const confirmButton =
        destructiveButton ||
        buttonList.find((button) => button?.style !== "cancel") ||
        null;
      const cancelButton =
        buttonList.find((button) => button?.style === "cancel") || null;
      const normalizedTitle = String(title || "");
      const normalizedLowerTitle = normalizedTitle.toLowerCase();
      const isSuccess =
        normalizedLowerTitle.includes("réussi") ||
        normalizedLowerTitle.includes("check-in") ||
        normalizedLowerTitle.includes("check-out") ||
        normalizedLowerTitle.includes("réserv") ||
        normalizedLowerTitle.includes("reserve") ||
        normalizedLowerTitle.includes("reserv");
      const isInfo =
        normalizedLowerTitle.includes("votre poste") ||
        normalizedLowerTitle.includes("déjà");
      const isWarning =
        !!destructiveButton ||
        normalizedLowerTitle.includes("incorrect") ||
        normalizedLowerTitle.includes("refus") ||
        normalizedLowerTitle.includes("permission");

      showFeedback({
        type: isSuccess
          ? "success"
          : isInfo
            ? "info"
            : isWarning
              ? "warning"
              : "error",
        title: normalizedTitle || "Information",
        message,
        confirmText: confirmButton?.text || "OK",
        cancelText: cancelButton?.text,
        onConfirm: confirmButton?.onPress,
        onCancel: cancelButton?.onPress,
      });
    },
    [showFeedback],
  );

  // ─────────────────────────────────────────────────────────────────
  // Derived reservation state
  // ─────────────────────────────────────────────────────────────────
  const mySeatLabel =
    myReservation?.seatLabel || myReservation?.SeatLabel || null;
  const mySeatId = myReservation?.seatId ?? myReservation?.SeatId ?? null;
  const hasMyReservation = !!mySeatLabel;

  const reservationStatus =
    myReservation?.status ?? myReservation?.Status ?? null;
  const reservationStatusText = String(reservationStatus ?? "").toLowerCase();
  const reservationCheckedInAt =
    myReservation?.checkedInAt ?? myReservation?.CheckedInAt ?? null;
  const isCheckedIn =
    reservationStatus === 2 ||
    reservationStatus === "CheckedIn" ||
    reservationStatusText === "2" ||
    reservationStatusText === "checkedin" ||
    reservationStatusText === "checked_in";
  const isCompleted =
    reservationStatus === 4 ||
    reservationStatus === "Completed" ||
    reservationStatusText === "4" ||
    reservationStatusText === "completed";
  const isCancelledOrNoShow =
    reservationStatus === 3 ||
    reservationStatus === 5 ||
    reservationStatusText === "3" ||
    reservationStatusText === "5" ||
    reservationStatusText === "cancelled" ||
    reservationStatusText === "canceled" ||
    reservationStatusText === "noshow" ||
    reservationStatusText === "no_show";
  const isActiveReservation =
    reservationStatus === 1 ||
    reservationStatus === "Active" ||
    reservationStatusText === "1" ||
    reservationStatusText === "active" ||
    (hasMyReservation && !isCheckedIn && !isCompleted && !isCancelledOrNoShow);

  // ─────────────────────────────────────────────────────────────────
  // Scanner
  // ─────────────────────────────────────────────────────────────────
  const openScanner = async () => {
    if (isE2e) {
      const qrPreset =
        myReservation?.seatQrCodeValue ??
        myReservation?.SeatQrCodeValue ??
        (mySeatId ? `SEAT:${mySeatId}` : "");
      setE2eQrValue(String(qrPreset).trim());
      setE2eQrPanelVisible(true);
      return;
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        showFeedbackAlert(
          "Permission refusée",
          "La caméra est nécessaire pour scanner le QR code.",
        );
        return;
      }
    }

    setScanned(false);
    setScannerVisible(true);
  };

  const submitE2eQr = async () => {
    const value = String(e2eQrValue || "").trim();
    if (!value) {
      showFeedbackAlert("QR requis", "Saisissez la valeur QR du poste.");
      return;
    }

    const expectedQr = String(
      myReservation?.seatQrCodeValue ??
        myReservation?.SeatQrCodeValue ??
        (mySeatId ? `SEAT:${mySeatId}` : ""),
    )
      .trim()
      .toUpperCase();
    const reservedSeat = String(mySeatLabel || "")
      .trim()
      .toUpperCase();
    const normalizedValue = value.toUpperCase();

    if (
      isE2e &&
      normalizedValue !== expectedQr &&
      normalizedValue !== reservedSeat
    ) {
      showFeedbackAlert(
        "QR incorrect",
        `Ce QR code ne correspond pas à votre poste réservé (${mySeatLabel}).`,
      );
      return;
    }

    await handleQrScanned({ data: value });
    setE2eQrPanelVisible(false);
  };

  const handleCheckOut = async () => {
    setCheckingOut(true);
    try {
      const response = await seatService.checkOutReservation();
      const result = response?.data ?? response;

      if (result?.success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        showFeedbackAlert(
          "Check-out réussi",
          "Votre journée de présence est terminée.",
        );
        await fetchMyReservation();
      } else {
        showFeedbackAlert(
          "Check-out refusé",
          result?.message || "Impossible de terminer le check-out.",
        );
      }
    } catch (error) {
      showFeedbackAlert(
        "Erreur",
        getErrorMessage(error, "Impossible de faire le check-out."),
      );
    } finally {
      setCheckingOut(false);
    }
  };

  const handleQrScanned = async ({ data }) => {
    if (scanned || checkingIn) return;

    setScanned(true);
    console.log("DESK QR DATA:", data);

    const resetScan = () => setTimeout(() => setScanned(false), 1500);

    const scannedValue = String(data).trim();
    const match = /^SEAT:(\d+)$/i.exec(scannedValue);
    const scannedSeatId = match ? Number(match[1]) : null;

    if (!match || !Number.isSafeInteger(scannedSeatId) || scannedSeatId <= 0) {
      showFeedbackAlert(
        "QR incorrect",
        "Le QR du poste doit avoir le format SEAT:{id}.",
        [{ text: "RÃ©essayer", onPress: resetScan }],
      );
      return;
    }

    if (Number(mySeatId) !== scannedSeatId) {
      showFeedbackAlert(
        "QR incorrect",
        `Ce QR code ne correspond pas à votre poste réservé (${mySeatLabel}).`,
        [{ text: "Réessayer", onPress: resetScan }],
      );
      return;
    }

    setCheckingIn(true);

    try {
      const response = await seatService.checkInReservation(
        `SEAT:${scannedSeatId}`,
      );
      const result = response?.data ?? response;

      if (result?.success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        setScannerVisible(false);
        setTimeout(() => {
          showFeedbackAlert(
            "Check-in réussi",
            "Votre présence a été confirmée.",
          );
        }, 200);
        await fetchMyReservation();
      } else {
        showFeedbackAlert(
          "Check-in refusé",
          result?.message || "Impossible de confirmer le check-in.",
          [{ text: "Réessayer", onPress: resetScan }],
        );
      }
    } catch (error) {
      showFeedbackAlert(
        "Erreur",
        getErrorMessage(error, "Impossible de faire le check-in."),
        [{ text: "Réessayer", onPress: resetScan }],
      );
    } finally {
      setCheckingIn(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Data fetching
  // ─────────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      fetchSeatMap();
      fetchMyReservation();
    }, []),
  );

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
        showFeedbackAlert(
          "Impossible de charger le plan",
          response.message || "Faites glisser vers le bas pour réessayer.",
        );
      }
    } catch (error) {
      showFeedbackAlert(
        "Impossible de charger le plan",
        getErrorMessage(
          error,
          "Vérifiez votre connexion et faites glisser pour actualiser.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchSeatMap(), fetchMyReservation()]);
  }, [selectedDate]);

  useEffect(() => {
    if (isE2e && mySeatId && !e2eQrValue) {
      setE2eQrValue(`SEAT:${mySeatId}`);
    }
  }, [isE2e, mySeatId, e2eQrValue]);

  // ─────────────────────────────────────────────────────────────────
  // Seat / table derived data
  // ─────────────────────────────────────────────────────────────────
  const prettyToday = useMemo(
    () =>
      new Date().toLocaleDateString("fr-FR", {
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

  // Auto-select: prefer the table containing the user's reservation,
  // otherwise fall back to the first table.
  useEffect(() => {
    if (!seatsByTable.length) return;

    if (mySeatLabel) {
      const myTable = seatsByTable.find((t) =>
        t.seats.some((s) => s.label === mySeatLabel),
      );
      if (myTable) {
        setSelectedTableId(myTable.tableId);
        // Scroll the chip into view
        const idx = seatsByTable.indexOf(myTable);
        if (idx > 0) {
          setTimeout(() => {
            tableSelectorRef.current?.scrollToIndex({
              index: idx,
              animated: true,
              viewPosition: 0.5,
            });
          }, 150);
        }
        return;
      }
    }

    if (!selectedTableId) {
      setSelectedTableId(seatsByTable[0].tableId);
    }
  }, [seatsByTable, mySeatLabel]);

  const selectedTable = useMemo(
    () => seatsByTable.find((t) => t.tableId === selectedTableId),
    [seatsByTable, selectedTableId],
  );

  // ─────────────────────────────────────────────────────────────────
  // Seat interactions
  // ─────────────────────────────────────────────────────────────────
  const handleSeatPress = (seat) => {
    if (!seat) return;
    const isMySeat = mySeatLabel && seat.label === mySeatLabel;

    if (isMySeat) {
      showFeedbackAlert(
        "Votre poste",
        `Vous avez le poste ${seat.label} pour aujourd'hui.`,
      );
      return;
    }

    if (seat.isReserved) {
      const reservedBy = seat.reservedBy || {};
      setReservedSeatInfo({
        seatLabel: seat.label,
        reservedBy: {
          fullName: reservedBy.fullName || reservedBy.FullName || "Inconnu",
          departmentName:
            reservedBy.departmentName || reservedBy.DepartmentName || "—",
        },
      });
      setShowReservedModal(true);
      return;
    }

    if (hasMyReservation) {
      showFeedbackAlert(
        "Déjà réservé",
        `Vous avez le poste ${mySeatLabel}. Annulez d'abord cette réservation.`,
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
        showFeedbackAlert(
          "Réservation confirmée",
          `Votre poste ${selectedAvailableSeat.label} a été réservé avec succès pour aujourd'hui.`,
        );
      } else {
        showFeedbackAlert(
          "Impossible de réserver",
          response.message || "Ce poste vient peut-être d'être pris.",
        );
      }
    } catch (error) {
      showFeedbackAlert(
        "Impossible de réserver",
        getErrorMessage(error, "Veuillez réessayer."),
      );
    } finally {
      setReservingSeatId(null);
    }
  };

  const handleCancelReservation = () => {
    if (!hasMyReservation) return;
    if (!isActiveReservation) {
      showFeedbackAlert(
        "Réservation non annulable",
        isCheckedIn
          ? "Vous avez déjà effectué le check-in. Utilisez le check-out pour terminer votre présence."
          : "Cette réservation ne peut plus être annulée.",
      );
      return;
    }

    showFeedbackAlert(
      "Annuler la réservation ?",
      `Libérer le poste ${mySeatLabel} pour aujourd'hui ?`,
      [
        { text: "Non", style: "cancel" },
        {
          text: "Oui",
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
        showFeedbackAlert(
          "Impossible d'annuler",
          response?.message || "Réessayez.",
        );
      }
    } catch (error) {
      showFeedbackAlert(
        "Impossible d'annuler",
        getErrorMessage(error, "Une erreur s'est produite."),
      );
    } finally {
      setCancelling(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Rendering helpers
  // ─────────────────────────────────────────────────────────────────
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
        testID={`desk.seat.${seat.label}`}
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
        accessibilityLabel={`Poste ${seat.label}${seat.isReserved ? ", occupé" : isMySeat ? ", votre poste" : ", disponible"}`}
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
    if (!table) return null;
    const layout = getTableLayout(table.seats);
    const isEleven = layout.type === "eleven";

    return (
      <Card key={table.tableId} style={styles.tableCard}>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.tableTitle}>{table.tableName}</Text>
          <Text style={styles.tableSubtitle}>{table.seats.length} postes</Text>
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

  // Table selector chip renderer
  const renderTableChip = useCallback(
    ({ item: table }) => {
      const isActive = table.tableId === selectedTableId;
      const hasMyTable =
        !!mySeatLabel && table.seats.some((s) => s.label === mySeatLabel);
      const available = table.seats.filter((s) => !s.isReserved).length;
      const total = table.seats.length;
      const DOT_LIMIT = 6;
      const dotsToShow = table.seats.slice(0, DOT_LIMIT);
      const overflow = table.seats.length - DOT_LIMIT;

      return (
        <TouchableOpacity
          style={[
            styles.tableOptionButton,
            isActive && styles.tableOptionButtonActive,
            hasMyTable && !isActive && styles.tableOptionButtonMine,
          ]}
          onPress={() => setSelectedTableId(table.tableId)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${table.tableName}, ${available} postes libres sur ${total}`}
          accessibilityState={{ selected: isActive }}
        >
          {/* Mini dot availability preview */}
          <View style={styles.tableOptionDots}>
            {dotsToShow.map((s) => (
              <View
                key={s.id}
                style={[
                  styles.tableOptionDot,
                  {
                    backgroundColor:
                      s.label === mySeatLabel
                        ? colors.seatMine
                        : s.isReserved
                          ? colors.seatReserved
                          : colors.seatAvailable,
                  },
                ]}
              />
            ))}
            {overflow > 0 && (
              <Text style={styles.tableOptionDotMore}>+{overflow}</Text>
            )}
          </View>

          <Text
            style={[
              styles.tableOptionName,
              isActive && styles.tableOptionNameActive,
            ]}
          >
            {table.tableName}
          </Text>
          <Text
            style={[
              styles.tableOptionAvailability,
              isActive && styles.tableOptionAvailabilityActive,
            ]}
          >
            {available}/{total} libres
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedTableId, mySeatLabel, colors, styles],
  );

  const renderTableSelector = () => {
    if (seatsByTable.length <= 1) return null;

    return (
      <Card style={styles.tableSelectorContainer}>
        <Text style={styles.tableSelectorTitle}>Choisir une table</Text>
        <FlatList
          ref={tableSelectorRef}
          data={seatsByTable}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.tableId}
          renderItem={renderTableChip}
          contentContainerStyle={styles.tableSelectorListContent}
          getItemLayout={(_, index) => ({
            length: 90,
            offset: 90 * index,
            index,
          })}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              tableSelectorRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.5,
              });
            }, 300);
          }}
        />
      </Card>
    );
  };

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerDate}>{prettyToday}</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>AUJOURD'HUI SEULEMENT</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          disabled={loading || refreshing}
          accessibilityLabel="Actualiser le plan des postes"
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
            <Text style={styles.statusHint}>
              Vérification de votre réservation…
            </Text>
          </View>
        ) : hasMyReservation ? (
          <View style={styles.statusRow}>
            <View style={[styles.statusIconWrap, styles.statusIconSuccess]}>
              <Ionicons name="checkmark" size={18} color={colors.success} />
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle}>
                Poste {mySeatLabel} réservé
              </Text>
              <Text style={styles.statusHint}>Aujourd&apos;hui · confirmé</Text>
              <Text testID="attendance.status" style={styles.statusHint}>
                {isCompleted
                  ? "checked-out"
                  : isCheckedIn
                    ? "checked-in"
                    : "reserved"}
              </Text>
              {isCheckedIn && reservationCheckedInAt ? (
                <Text testID="desk.checkInStatus" style={styles.statusHint}>
                  Check-in :{" "}
                  {new Date(reservationCheckedInAt).toLocaleTimeString(
                    "fr-FR",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                </Text>
              ) : null}
              {isCompleted ? (
                <Text testID="desk.checkOutStatus" style={styles.statusHint}>
                  Check-out effectué
                </Text>
              ) : null}
            </View>
            <Button
              testID="attendance.checkInButton"
              title={isCheckedIn ? "Présent" : "Scanner QR"}
              onPress={openScanner}
              disabled={checkingIn || isCheckedIn || !isActiveReservation}
              style={{ marginRight: 8 }}
            />
            {isCheckedIn ? (
              <Button
                testID="attendance.checkOutButton"
                title="Check-out"
                variant="secondary"
                onPress={handleCheckOut}
                loading={checkingOut}
                disabled={checkingOut}
                style={{ marginRight: 8 }}
              />
            ) : null}
            <Button
              testID="desk.cancelReservationButton"
              title="Libérer"
              variant="danger-outline"
              onPress={handleCancelReservation}
              loading={cancelling}
              disabled={cancelling || !isActiveReservation}
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
              <Text style={styles.statusTitle}>Aucun poste réservé</Text>
              <Text style={styles.statusHint}>
                Appuyez sur un poste vert pour réserver
              </Text>
            </View>
          </View>
        )}
      </Card>

      {/* Seat map */}
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
          {renderTableSelector()}

          {selectedTable ? renderTable(selectedTable) : null}

          {seats.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="grid-outline"
                size={40}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>Aucun poste disponible</Text>
              <Text style={styles.emptyHint}>
                Faites glisser pour actualiser ou réessayez plus tard.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: colors.seatMine, label: "Le vôtre" },
          { color: colors.seatAvailable, label: "Libre" },
          { color: colors.seatReserved, label: "Occupé" },
          { color: colors.border, label: "N/D" },
        ].map(({ color, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Reserved seat info modal */}
      <Modal
        visible={showReservedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReservedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.infoModalContent}>
            <Text style={styles.infoModalTitle}>Poste occupé</Text>
            {reservedSeatInfo && (
              <>
                <Text style={styles.infoModalSeat}>
                  Poste {reservedSeatInfo.seatLabel}
                </Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Réservé par</Text>
                  <Text style={styles.infoValue}>
                    {reservedSeatInfo.reservedBy.fullName}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Département</Text>
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

      {/* Seat reservation action panel */}
      {selectedAvailableSeat && (
        <View style={styles.actionPanel}>
          <View style={styles.actionPanelLeft}>
            <Text style={styles.actionPanelTitle}>
              Poste {selectedAvailableSeat.label}
            </Text>
            <Text style={styles.actionPanelSubtitle}>
              Appuyez sur confirmer pour réserver pour aujourd&apos;hui
            </Text>
          </View>
          <Button
            testID="desk.confirmReservationButton"
            title="Confirmer"
            onPress={confirmSeatReservation}
            loading={!!reservingSeatId}
            disabled={!!reservingSeatId}
            style={styles.actionPanelButton}
          />
        </View>
      )}

      {/* E2E QR panel */}
      {isE2e && e2eQrPanelVisible && (
        <View style={styles.e2eQrPanel}>
          <Text style={styles.e2eQrTitle}>Mode E2E — QR simulé</Text>
          <TouchableOpacity
            testID="e2eFakeQrButton"
            style={styles.e2eQrPresetButton}
            onPress={() => setE2eQrValue(mySeatId ? `SEAT:${mySeatId}` : "")}
          >
            <Text style={styles.e2eQrPresetText}>
              Utiliser le QR du poste ({mySeatLabel || "—"})
            </Text>
          </TouchableOpacity>
          <TextInput
            testID="e2eFakeQrInput"
            style={styles.e2eQrInput}
            value={e2eQrValue}
            onChangeText={setE2eQrValue}
            placeholder="Valeur QR"
            autoCapitalize="characters"
          />
          <View style={styles.e2eQrActions}>
            <Button
              testID="e2eSubmitQrButton"
              title="Valider le QR"
              onPress={submitE2eQr}
              loading={checkingIn}
              disabled={checkingIn}
            />
            <Button
              title="Fermer"
              variant="secondary"
              onPress={() => setE2eQrPanelVisible(false)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      )}

      {/* QR scanner modal */}
      <Modal
        visible={scannerVisible && !isE2e}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleQrScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerTitle}>Scanner le QR code du poste</Text>
            <View style={styles.qrFrame} />
            <Text style={styles.scannerHint}>
              Placez le QR code dans le cadre
            </Text>
            {checkingIn && (
              <ActivityIndicator
                size="large"
                color="#fff"
                style={{ marginTop: 20 }}
              />
            )}
            <TouchableOpacity
              style={styles.closeScannerBtn}
              onPress={() => setScannerVisible(false)}
            >
              <Ionicons name="close" size={22} color="#fff" />
              <Text style={styles.closeScannerText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Feedback modal */}
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
};

export default DeskScreen;
