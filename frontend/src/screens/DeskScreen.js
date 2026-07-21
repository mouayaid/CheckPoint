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
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { seatService } from "../services/api";
import { formatDate, getTunisiaNow } from "../utils/helpers";
import { Button, Card } from "../components";
import { useTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import FeedbackModal from "../components/FeedbackModal";
import { useFeedback } from "../hooks/useFeedback";
import { getTableSeatLayout } from "../utils/seatLayout";

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
      flexGrow: 0,
      flexShrink: 0,
      width: undefined,
      alignSelf: "stretch",
    },
    statusCardBooked: {
      backgroundColor: colors.successLight,
      borderColor: colors.success,
    },
    statusCardError: {
      backgroundColor: colors.errorLight ?? colors.surface,
      borderColor: colors.error,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      flexWrap: "wrap",
      columnGap: spacing.md,
      rowGap: spacing.sm,
    },
    activeReservationCardBody: {
      gap: spacing.md,
    },
    activeReservationHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
    },
    activeReservationText: {
      flex: 1,
      minWidth: 0,
    },
    activeReservationTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    statusPill: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      backgroundColor: colors.success,
    },
    statusPillText: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: colors.textOnPrimary,
    },
    activeReservationActions: {
      marginTop: spacing.xs,
      gap: spacing.sm,
    },

    scanActionButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: spacing.md,
    },

    scanActionButtonDisabled: {
      opacity: 0.55,
    },

    scanActionText: {
      color: colors.textOnPrimary,
      fontSize: typography.sm,
      fontWeight: typography.bold,
    },

    separator: {
      height: 1,
      backgroundColor: colors.border,
      opacity: 0.5,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },

    releaseTextButton: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: spacing.sm,
    },

    releaseText: {
      color: colors.error,
      fontSize: typography.sm,
      fontWeight: typography.semibold,
    },

    releaseTextDisabled: {
      opacity: 0.5,
    },

    releaseActionButton: {
      minHeight: 48,
      minWidth: 112,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
    },

    releaseActionButtonDisabled: {
      opacity: 0.55,
    },

    releaseActionText: {
      color: colors.primary,
      fontSize: typography.sm,
      fontWeight: typography.semibold,
    },

    statusIconWrap: {
      width: 38,
      height: 38,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    // FIX: was referenced in JSX but never defined, so the checkmark icon
    // silently kept the default muted background instead of a success tint.
    statusIconSuccess: {
      backgroundColor: colors.successLight ?? colors.surfaceMuted,
    },
    statusIconError: {
      backgroundColor: colors.errorLight ?? colors.surfaceMuted,
    },
    statusTextWrap: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
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
    statusRetryBtn: {
      marginTop: spacing.sm,
      alignSelf: "flex-start",
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
    emptyRetryButton: {
      marginTop: spacing.sm,
      minWidth: 160,
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
    topSeatContainer: {
      marginBottom: spacing.md,
      alignItems: "center",
    },
    topSeatIcon: { transform: [{ rotate: "180deg" }] },

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
    cameraPermissionCard: {
      width: Math.min(width * 0.92, 380),
      padding: spacing.xl,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      alignItems: "center",
      ...shadows.lg,
    },

    cameraPermissionIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },

    cameraPermissionTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    cameraPermissionText: {
      fontSize: typography.sm,
      lineHeight: 21,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: spacing.lg,
    },

    cameraPermissionActions: {
      width: "100%",
      gap: spacing.sm,
    },

    cameraPermissionPrimaryButton: {
      width: "100%",
    },

    cameraPermissionSecondaryButton: {
      width: "100%",
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
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { feedback, showFeedback, hideFeedback } = useFeedback();

  const styles = useMemo(
    () =>
      createStyles(colors, spacing, borderRadius, typography, shadows, insets),
    [colors, spacing, borderRadius, typography, shadows, insets],
  );

  const selectedDate = useMemo(() => formatDate(getTunisiaNow()), []);

  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  // FIX: track load failures separately from "loaded but genuinely empty"
  const [seatMapError, setSeatMapError] = useState(null);

  const [loadingMyReservation, setLoadingMyReservation] = useState(true);
  // FIX: same idea for the "my reservation" fetch — a failed lookup should
  // not be silently treated the same as "you have nothing booked today".
  const [myReservationError, setMyReservationError] = useState(null);

  const [reservingSeatId, setReservingSeatId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const [showReservedModal, setShowReservedModal] = useState(false);
  const [reservedSeatInfo, setReservedSeatInfo] = useState(null);
  const [selectedAvailableSeat, setSelectedAvailableSeat] = useState(null);

  const [myReservation, setMyReservation] = useState(null);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [requestingCameraPermission, setRequestingCameraPermission] =
    useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const [selectedTableId, setSelectedTableId] = useState(null);
  const tableSelectorRef = useRef(null);

  // FIX: keep a handle on the "reset scanned flag" timeout so it can be
  // cleared if the scanner modal closes or the component unmounts before
  // it fires (previously it always fired 1.5s later regardless).
  const resetScanTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (resetScanTimeoutRef.current) {
        clearTimeout(resetScanTimeoutRef.current);
      }
    };
  }, []);

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
    reservationStatusText === "checked_in" ||
    reservationStatusText === "present" ||
    reservationStatusText === "inprogress" ||
    reservationStatusText === "in_progress";
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
  const hasActiveDeskReservation =
    hasMyReservation && !isCompleted && !isCancelledOrNoShow;
  const activeSeatLabel = hasActiveDeskReservation ? mySeatLabel : null;

  // ─────────────────────────────────────────────────────────────────
  // Scanner
  // ─────────────────────────────────────────────────────────────────
  const startScanner = () => {
    setScanned(false);
    setScannerVisible(true);
  };

  const openScanner = () => {
    if (!permission) {
      showFeedbackAlert(
        "Caméra indisponible",
        "Impossible de vérifier l'autorisation de la caméra. Veuillez réessayer.",
      );
      return;
    }

    if (permission.granted) {
      startScanner();
      return;
    }

    setPermissionModalVisible(true);
  };

  const handleCameraPermissionRequest = async () => {
    if (requestingCameraPermission) return;

    if (!permission?.canAskAgain) {
      setPermissionModalVisible(false);

      showFeedbackAlert(
        "Autorisation requise",
        "L'accès à la caméra est désactivé. Activez-le dans les paramètres de votre téléphone.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Ouvrir les paramètres",
            onPress: async () => {
              try {
                await Linking.openSettings();
              } catch {
                showFeedbackAlert(
                  "Impossible d'ouvrir les paramètres",
                  "Ouvrez les paramètres de votre téléphone et autorisez manuellement l'accès à la caméra.",
                );
              }
            },
          },
        ],
      );

      return;
    }

    setRequestingCameraPermission(true);

    try {
      const result = await requestPermission();

      setPermissionModalVisible(false);

      if (result.granted) {
        startScanner();
        return;
      }

      showFeedbackAlert(
        "Caméra non autorisée",
        result.canAskAgain
          ? "L'accès à la caméra est nécessaire pour scanner le QR code de votre poste."
          : "L'accès à la caméra est désactivé. Vous pouvez l'activer depuis les paramètres de votre téléphone.",
        !result.canAskAgain
          ? [
            { text: "Annuler", style: "cancel" },
            {
              text: "Ouvrir les paramètres",
              onPress: () => Linking.openSettings(),
            },
          ]
          : null,
      );
    } catch (error) {
      setPermissionModalVisible(false);

      showFeedbackAlert(
        "Erreur",
        getErrorMessage(error, "Impossible de demander l'accès à la caméra."),
      );
    } finally {
      setRequestingCameraPermission(false);
    }
  };

  const handleQrScanned = async ({ data }) => {
    if (scanned || checkingIn) return;

    setScanned(true);
    console.log("DESK QR DATA:", data);

    const resetScan = () => {
      if (resetScanTimeoutRef.current) {
        clearTimeout(resetScanTimeoutRef.current);
      }
      resetScanTimeoutRef.current = setTimeout(() => {
        setScanned(false);
        resetScanTimeoutRef.current = null;
      }, 1500);
    };

    const scannedValue = String(data).trim();
    const match = /^SEAT:(\d+)$/i.exec(scannedValue);
    const scannedSeatId = match ? Number(match[1]) : null;

    if (!match || !Number.isSafeInteger(scannedSeatId) || scannedSeatId <= 0) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFeedbackAlert(
        "QR incorrect",
        "Le QR du poste doit avoir le format SEAT:{id}.",
        [{ text: "Réessayer", onPress: resetScan }],
      );
      return;
    }

    if (Number(mySeatId) !== scannedSeatId) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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

      if (response?.success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );

        setScannerVisible(false);

        setTimeout(() => {
          showFeedbackAlert(
            "Check-in réussi",
            response?.message || "Votre présence a été confirmée.",
          );
        }, 200);

        await Promise.all([fetchSeatMap(), fetchMyReservation()]);
      } else {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        );

        showFeedbackAlert(
          "Check-in refusé",
          response?.message || "Impossible de confirmer le check-in.",
          [{ text: "Réessayer", onPress: resetScan }],
        );
      }
    } catch (error) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );

      showFeedbackAlert(
        "Erreur",
        getErrorMessage(error, "Impossible de faire le check-in."),
        [{ text: "Réessayer", onPress: resetScan }],
      );
    } finally {
      setCheckingIn(false);
    }
  };

  // Data fetching
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
    // FIX: clear any previous error at the start of a new attempt so a
    // stale error banner doesn't linger after a successful retry.
    setMyReservationError(null);
    try {
      const response = await seatService.getMyTodayReservation();
      const raw = response?.data ?? null;
      if (response?.success) {
        setMyReservation(raw ?? null);
      } else {
        // Request completed but server reported failure — distinct from
        // "you simply have no reservation today".
        setMyReservation(null);
        setMyReservationError(
          response?.message || "Impossible de vérifier votre réservation.",
        );
      }
    } catch (error) {
      setMyReservation(null);
      setMyReservationError(
        getErrorMessage(error, "Impossible de vérifier votre réservation."),
      );
    } finally {
      setLoadingMyReservation(false);
    }
  };

  const fetchSeatMap = async () => {
    setLoading(true);
    // FIX: clear stale error state before a fresh attempt.
    setSeatMapError(null);
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
        const message =
          response.message || "Faites glisser vers le bas pour réessayer.";
        setSeats([]);
        setSeatMapError(message);
        showFeedbackAlert("Impossible de charger le plan", message);
      }
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Vérifiez votre connexion et faites glisser pour actualiser.",
      );
      setSeats([]);
      setSeatMapError(message);
      showFeedbackAlert("Impossible de charger le plan", message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchSeatMap(), fetchMyReservation()]);
  }, [selectedDate]);

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

    if (activeSeatLabel) {
      const myTable = seatsByTable.find((t) =>
        t.seats.some((s) => s.label === activeSeatLabel),
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
  }, [seatsByTable, activeSeatLabel]);

  const selectedTable = useMemo(
    () => seatsByTable.find((t) => t.tableId === selectedTableId),
    [seatsByTable, selectedTableId],
  );

  // ─────────────────────────────────────────────────────────────────
  // Seat interactions
  // ─────────────────────────────────────────────────────────────────
  const handleSeatPress = (seat) => {
    if (!seat) return;
    const isMySeat = activeSeatLabel && seat.label === activeSeatLabel;

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

    if (hasActiveDeskReservation) {
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
    if (!hasActiveDeskReservation) return;
    if (!isActiveReservation) {
      showFeedbackAlert(
        "Réservation non annulable",
        isCheckedIn
          ? "Vous avez déjà confirmé votre arrivée. Ce poste reste assigné jusqu'à 17:00."
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
    const isMySeat = activeSeatLabel && seat.label === activeSeatLabel;
    const isSelected = selectedAvailableSeat?.id === seat.id;
    const isLoadingThisSeat = reservingSeatId === seat.id;

    if (isMySeat) return colors.seatMine;
    if (isLoadingThisSeat || isSelected) return colors.seatSelected;
    if (seat.isReserved) return colors.seatReserved;
    if (hasActiveDeskReservation) return colors.border;
    return colors.seatAvailable;
  };

  const renderSeat = (seat, position = "side") => {
    const isMySeat = activeSeatLabel && seat.label === activeSeatLabel;
    const isLoadingThisSeat = reservingSeatId === seat.id;
    const isDisabled =
      cancelling ||
      !!reservingSeatId ||
      (hasActiveDeskReservation && !seat.isReserved && !isMySeat);
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
              style={position === "top" ? styles.topSeatIcon : undefined}
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
    const layout = getTableSeatLayout(table.seats);
    const tableMinHeight = Math.max(140, layout.maxSideCount * 58);

    return (
      <Card key={table.tableId} style={styles.tableCard}>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.tableTitle}>{table.tableName}</Text>
          <Text style={styles.tableSubtitle}>{table.seats.length} postes</Text>
        </View>

        <View style={styles.tableWrap}>
          {layout.topSeat && (
            <View style={styles.topSeatContainer}>
              {renderSeat(layout.topSeat, "top")}
            </View>
          )}
          <View style={styles.tableRow}>
            {renderSeatColumn(layout.leftSeats)}

            <View style={styles.tableCenter}>
              <View style={[styles.tableVisual, { minHeight: tableMinHeight }]}>
                <View style={styles.tableInnerLine} />
                <Text style={styles.tableVisualText}>{table.tableName}</Text>
              </View>
            </View>

            {renderSeatColumn(layout.rightSeats)}
          </View>
        </View>
      </Card>
    );
  };

  // Table selector chip renderer
  const renderTableChip = useCallback(
    ({ item: table }) => {
      const isActive = table.tableId === selectedTableId;
      const hasMyTable =
        !!activeSeatLabel &&
        table.seats.some((s) => s.label === activeSeatLabel);
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
                      s.label === activeSeatLabel
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
    [selectedTableId, activeSeatLabel, colors, styles],
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
          hasActiveDeskReservation &&
          !loadingMyReservation &&
          styles.statusCardBooked,
          // FIX: distinct visual state when the "my reservation" lookup failed,
          // instead of silently rendering the same look as "nothing booked".
          !loadingMyReservation &&
          !hasActiveDeskReservation &&
          myReservationError &&
          styles.statusCardError,
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
        ) : hasActiveDeskReservation ? (
          <View style={styles.activeReservationCardBody}>
            <View style={styles.activeReservationHeader}>
              <View style={[styles.statusIconWrap, styles.statusIconSuccess]}>
                <Ionicons name="checkmark" size={18} color={colors.success} />
              </View>

              <View style={styles.activeReservationText}>
                <View style={styles.activeReservationTitleRow}>
                  <Text style={styles.statusTitle} numberOfLines={1}>
                    Poste {mySeatLabel} réservé
                  </Text>

                  {isCheckedIn ? (
                    <View style={styles.statusPill}>
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color={colors.textOnPrimary}
                      />
                      <Text style={styles.statusPillText}>Présent</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.statusHint} numberOfLines={2}>
                  Aujourd&apos;hui
                  {isCheckedIn && reservationCheckedInAt
                    ? ` · Check-in : ${new Date(
                      reservationCheckedInAt,
                    ).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                    : " · en attente du QR"}
                </Text>
              </View>
            </View>

            <View style={styles.activeReservationActions}>
              {isCheckedIn ? (
                <Text style={styles.statusHint}>
                  Arrivée confirmée. Votre poste reste assigné jusqu'à 17:00.
                </Text>
              ) : (
                <>
                  <TouchableOpacity
                    testID="attendance.checkInButton"
                    style={[
                      styles.scanActionButton,
                      (checkingIn || !isActiveReservation) &&
                      styles.scanActionButtonDisabled,
                    ]}
                    onPress={openScanner}
                    disabled={checkingIn || !isActiveReservation}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Scanner le QR code du poste"
                  >
                    {checkingIn ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.textOnPrimary}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="qr-code-outline"
                          size={19}
                          color={colors.textOnPrimary}
                        />

                        <Text style={styles.scanActionText}>
                          Scanner le QR code
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {isActiveReservation ? (
                    <>
                      <View style={styles.separator} />

                      <TouchableOpacity
                        testID="desk.cancelReservationButton"
                        style={[
                          styles.releaseTextButton,
                          cancelling && styles.releaseTextDisabled,
                        ]}
                        onPress={handleCancelReservation}
                        disabled={cancelling}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Annuler la réservation"
                      >
                        {cancelling ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.error}
                          />
                        ) : (
                          <>
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color={colors.error}
                            />

                            <Text style={styles.releaseText}>
                              Annuler la réservation
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : null}
                </>
              )}
            </View>
          </View>
        ) : myReservationError ? (
          // FIX: dedicated error state — previously indistinguishable from
          // "you have no reservation today".
          <View style={styles.statusRow}>
            <View style={[styles.statusIconWrap, styles.statusIconError]}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={colors.error}
              />
            </View>

            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle}>
                Impossible de vérifier votre réservation
              </Text>
              <Text style={styles.statusHint}>{myReservationError}</Text>
              <TouchableOpacity
                style={styles.statusRetryBtn}
                onPress={fetchMyReservation}
                accessibilityRole="button"
                accessibilityLabel="Réessayer de vérifier votre réservation"
              >
                <Text
                  style={[styles.releaseText, { color: colors.primary }]}
                >
                  Réessayer
                </Text>
              </TouchableOpacity>
            </View>
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
      {loading && !refreshing ? (
        // FIX: only show the full-screen spinner on the *initial* load.
        // If a pull-to-refresh is already in progress, keep the seat map
        // mounted and let RefreshControl's own spinner communicate the
        // loading state — previously the whole map would disappear and
        // be replaced by a second, redundant spinner during every
        // pull-to-refresh.
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

          {seats.length === 0 && seatMapError ? (
            // FIX: distinct "failed to load" state vs. genuine empty state.
            <View style={styles.emptyContainer}>
              <Ionicons
                name="cloud-offline-outline"
                size={40}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>
                Impossible de charger le plan
              </Text>
              <Text style={styles.emptyHint}>{seatMapError}</Text>
              <Button
                title="Réessayer"
                variant="secondary"
                onPress={fetchSeatMap}
                style={styles.emptyRetryButton}
              />
            </View>
          ) : (
            seats.length === 0 && (
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
            )
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
      {/* Camera permission modal */}
      <Modal
        visible={permissionModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!requestingCameraPermission) {
            setPermissionModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.cameraPermissionCard}>
            <View style={styles.cameraPermissionIcon}>
              <Ionicons
                name="qr-code-outline"
                size={34}
                color={colors.primary}
              />
            </View>

            <Text style={styles.cameraPermissionTitle}>
              Scanner votre poste
            </Text>

            <Text style={styles.cameraPermissionText}>
              Pour confirmer votre présence, scannez le QR code affiché sur
              votre poste de travail.
            </Text>

            <View style={styles.cameraPermissionActions}>
              <Button
                title={
                  permission?.canAskAgain === false
                    ? "Ouvrir les paramètres"
                    : "Autoriser l'accès à la caméra"
                }
                onPress={handleCameraPermissionRequest}
                loading={requestingCameraPermission}
                disabled={requestingCameraPermission}
                style={styles.cameraPermissionPrimaryButton}
              />

              <Button
                title="Annuler"
                variant="secondary"
                onPress={() => setPermissionModalVisible(false)}
                disabled={requestingCameraPermission}
                style={styles.cameraPermissionSecondaryButton}
              />
            </View>
          </Card>
        </View>
      </Modal>
      {/* QR scanner modal */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => {
          setScannerVisible(false);
          // FIX: cancel any pending "reset scanned flag" timeout when the
          // scanner is closed so it doesn't fire against a hidden modal.
          if (resetScanTimeoutRef.current) {
            clearTimeout(resetScanTimeoutRef.current);
            resetScanTimeoutRef.current = null;
          }
        }}
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
              onPress={() => {
                setScannerVisible(false);
                if (resetScanTimeoutRef.current) {
                  clearTimeout(resetScanTimeoutRef.current);
                  resetScanTimeoutRef.current = null;
                }
              }}
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
