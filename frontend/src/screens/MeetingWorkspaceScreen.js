import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

import { useTheme } from "../context/ThemeContext";
import roomService from "../services/api/roomService";
import { roomReservationService } from "../services/api/roomReservationService";
import { meetingTranscriptionService } from "../services/api/meetingTranscriptionService";
import FeedbackModal from "../components/FeedbackModal";
import { useFeedback } from "../hooks/useFeedback";

const valueOf = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];
const reservationIdOf = (reservation) => valueOf(reservation, "id", "Id");

function statusKey(status) {
  if (typeof status === "number") {
    return ({ 0: "pending", 1: "active", 2: "cancelled", 3: "completed", 4: "rejected", 5: "inprogress" })[status] ?? String(status);
  }
  return String(status ?? "").toLowerCase();
}

function parseRoomQr(data) {
  const match = /^ROOM:(\d+)$/i.exec(String(data ?? "").trim());
  if (!match) return null;
  const roomId = Number(match[1]);
  return Number.isSafeInteger(roomId) && roomId > 0 ? roomId : null;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeTranscriptions(payload) {
  const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
  return [...rows].sort(
    (a, b) =>
      new Date(valueOf(b, "createdAt", "CreatedAt") || 0) -
      new Date(valueOf(a, "createdAt", "CreatedAt") || 0),
  );
}

function transcriptionKey(transcription, index) {
  return String(valueOf(transcription, "id", "Id") ?? valueOf(transcription, "createdAt", "CreatedAt") ?? index);
}

function cleanMeetingText(value, fallback) {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[\uFEFF\uFFFD]/g, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || fallback;
}

function formatElapsedTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export default function MeetingWorkspaceScreen({ route }) {
  const initialReservation = route.params?.reservation ?? null;
  const reservationId = route.params?.reservationId ?? reservationIdOf(initialReservation);
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const { feedback, showFeedback, hideFeedback } = useFeedback();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
  );

  const [reservation, setReservation] = useState(initialReservation);
  const [transcriptions, setTranscriptions] = useState([]);
  const [expandedTranscriptionKey, setExpandedTranscriptionKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLock = useRef(false);
  const [recording, setRecording] = useState(null);
  const recordingRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const loadReservation = useCallback(async () => {
    if (reservationId == null) return;
    const response = await roomService.getMyReservations();
    const rows = response?.data ?? [];
    const current = rows.find((item) => reservationIdOf(item) === reservationId);
    if (current) setReservation(current);
  }, [reservationId]);

  const loadTranscriptions = useCallback(async ({ expandNewest = false } = {}) => {
    if (reservationId == null) return;
    try {
      const response = await meetingTranscriptionService.getByReservation(reservationId);
      const rows = normalizeTranscriptions(response?.data ?? response);
      setTranscriptions(rows);
      setExpandedTranscriptionKey((current) =>
        expandNewest || current == null ? (rows[0] ? transcriptionKey(rows[0], 0) : null) : current,
      );
    } catch (error) {
      if (error?.status === 404 || error?.response?.status === 404) {
        setTranscriptions([]);
        setExpandedTranscriptionKey(null);
      } else {
        Alert.alert("Erreur", "Impossible de charger la transcription.");
      }
    }
  }, [reservationId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadReservation(), loadTranscriptions()]);
    } catch (error) {
      Alert.alert("Erreur", error?.message || "Impossible de charger la réunion.");
    } finally {
      setLoading(false);
    }
  }, [loadReservation, loadTranscriptions]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
  }, []);

  const currentStatus = statusKey(valueOf(reservation, "status", "Status"));
  const roomId = Number(valueOf(reservation, "roomId", "RoomId"));
  const roomName = valueOf(reservation, "roomName", "RoomName") || "Salle";

  const openScanner = async () => {
    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();
    if (!permission?.granted) {
      Alert.alert("Permission refusée", "L'accès à la caméra est nécessaire pour scanner le QR.");
      return;
    }
    scanLock.current = false;
    setScanning(false);
    setScannerVisible(true);
  };

  const handleQrScanned = async ({ data }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setScanning(true);
    console.log("ROOM QR DATA:", data);

    const scannedRoomId = parseRoomQr(data);
    if (scannedRoomId == null) {
      Alert.alert("QR invalide", "Le QR doit avoir le format ROOM:{id}.");
      scanLock.current = false;
      setScanning(false);
      return;
    }
    if (scannedRoomId !== roomId) {
      Alert.alert("Mauvaise salle", `Ce QR ne correspond pas à ${roomName}.`);
      scanLock.current = false;
      setScanning(false);
      return;
    }

    try {
      await roomReservationService.scanStart(reservationId, scannedRoomId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScannerVisible(false);
      await loadReservation();
      showFeedback({
        type: "success",
        title: "Réunion démarrée",
        message: "La réunion est maintenant en cours. Vous pouvez lancer l’enregistrement.",
        confirmText: "Commencer",
      });
    } catch (error) {
      Alert.alert("Erreur", error?.message || "Impossible de démarrer la réunion.");
    } finally {
      scanLock.current = false;
      setScanning(false);
    }
  };

  const startRecording = async () => {
    if (currentStatus !== "inprogress") return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission refusée", "L'accès au microphone est nécessaire.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const created = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = created.recording;
      setRecording(created.recording);
      setRecordingElapsed(0);
      recordingStartedAtRef.current = Date.now();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingElapsed(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000));
      }, 1000);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de démarrer l'enregistrement.");
    }
  };

  const stopRecordingAndUpload = async () => {
    if (!recording) return;
    setUploading(true);
    try {
      await recording.stopAndUnloadAsync();
      const audioUri = recording.getURI();
      recordingRef.current = null;
      setRecording(null);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (!audioUri) throw new Error("Fichier audio introuvable.");
      showFeedback({
        type: "processing",
        title: "Analyse en cours",
        message: "Whisper transcrit l’audio puis l’IA génère le résumé. Cela peut prendre quelques instants.",
      });
      await meetingTranscriptionService.uploadAudio(reservationId, audioUri);
      await loadTranscriptions({ expandNewest: true });
      showFeedback({
        type: "success",
        title: "Transcription prête",
        message: "La transcription, le résumé et les tâches ont été générés avec succès.",
        confirmText: "Voir le résultat",
      });
    } catch (error) {
      hideFeedback();
      Alert.alert("Échec de la transcription", error?.message || "Impossible d'envoyer l'enregistrement.");
    } finally {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setUploading(false);
      recordingStartedAtRef.current = null;
      setRecordingElapsed(0);
    }
  };

  const finishMeeting = () => {
    Alert.alert("Terminer la réunion ?", "La salle sera libérée immédiatement.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Terminer",
        style: "destructive",
        onPress: async () => {
          setFinishing(true);
          try {
            await roomReservationService.finishReservation(reservationId);
            await loadReservation();
            showFeedback({
              type: "success",
              title: "Réunion terminée",
              message: "La salle a été libérée et les données de réunion sont sauvegardées.",
              confirmText: "OK",
            });
          } catch (error) {
            Alert.alert("Erreur", error?.message || "Impossible de terminer la réunion.");
          } finally {
            setFinishing(false);
          }
        },
      },
    ]);
  };

  if (loading && !reservation) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const statusConfig = {
    active: ["Confirmée", colors.success],
    inprogress: ["En cours", colors.info],
    completed: ["Terminée", colors.textSecondary],
    pending: ["En attente", colors.warning],
    cancelled: ["Annulée", colors.textSecondary],
    rejected: ["Rejetée", colors.error],
  }[currentStatus] ?? [currentStatus || "—", colors.textSecondary];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.titleRow}>
            <View style={styles.roomIcon}><Ionicons name="business" size={24} color={colors.primary} /></View>
            <View style={styles.titleCopy}>
              <Text style={styles.roomName}>{roomName}</Text>
              <Text style={styles.dateText}>{formatDateTime(valueOf(reservation, "startDateTime", "StartDateTime"))}</Text>
            </View>
            <View style={[styles.badge, { borderColor: statusConfig[1] }]}>
              <Text style={[styles.badgeText, { color: statusConfig[1] }]}>{statusConfig[0]}</Text>
            </View>
          </View>
          <InfoRow icon="time-outline" label="Fin" value={formatDateTime(valueOf(reservation, "endDateTime", "EndDateTime"))} styles={styles} colors={colors} />
          <InfoRow icon="chatbox-ellipses-outline" label="Objet" value={valueOf(reservation, "purpose", "Purpose") || "Aucun objet"} styles={styles} colors={colors} />
          {!!valueOf(reservation, "startedAt", "StartedAt") && <InfoRow icon="play-outline" label="Démarrée" value={formatDateTime(valueOf(reservation, "startedAt", "StartedAt"))} styles={styles} colors={colors} />}
          {!!valueOf(reservation, "finishedAt", "FinishedAt") && <InfoRow icon="checkmark-outline" label="Terminée" value={formatDateTime(valueOf(reservation, "finishedAt", "FinishedAt"))} styles={styles} colors={colors} />}
        </View>

        {currentStatus === "active" && !valueOf(reservation, "startedAt", "StartedAt") && (
          <ActionButton icon="qr-code-outline" label="Scanner le QR pour démarrer" onPress={openScanner} styles={styles} />
        )}

        {currentStatus === "inprogress" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Enregistrement</Text>
            {recording ? (
              <View style={styles.recordingStatus}>
                <View style={styles.recordingDot} />
                <View style={styles.recordingStatusCopy}>
                  <Text style={styles.recordingText}>Enregistrement en cours</Text>
                  <Text style={styles.recordingTimer}>{formatElapsedTime(recordingElapsed)}</Text>
                </View>
              </View>
            ) : <Text style={styles.emptyText}>Enregistrez la discussion pour générer un compte rendu.</Text>}
            <TouchableOpacity style={[styles.secondaryButton, uploading && styles.disabled]} disabled={uploading} onPress={recording ? stopRecordingAndUpload : startRecording}>
              {uploading ? <ActivityIndicator color={colors.primary} /> : <Ionicons name={recording ? "stop-circle-outline" : "mic-outline"} size={20} color={colors.primary} />}
              <Text style={styles.secondaryButtonText}>{uploading ? "Traitement par Whisper..." : recording ? "Arrêter et générer la transcription" : "Démarrer l'enregistrement"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.finishButton, finishing && styles.disabled]} disabled={finishing || uploading || !!recording} onPress={finishMeeting}>
              {finishing ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />}
              <Text style={styles.finishButtonText}>Terminer la réunion</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Enregistrements / transcriptions</Text>
          {transcriptions.length > 0 ? transcriptions.map((item, index) => {
            const itemKey = transcriptionKey(item, index);
            const expanded = expandedTranscriptionKey === itemKey;
            const createdAt = valueOf(item, "createdAt", "CreatedAt");
            const parsedCreatedAt = new Date(createdAt);
            const createdTime = createdAt && !Number.isNaN(parsedCreatedAt.getTime())
              ? parsedCreatedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
              : "heure inconnue";
            return (
              <View key={itemKey} style={styles.transcriptionCard}>
                <TouchableOpacity
                  style={styles.transcriptionHeader}
                  onPress={() => setExpandedTranscriptionKey(expanded ? null : itemKey)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <Text style={styles.transcriptionHeaderText}>Enregistrement {transcriptions.length - index} — {createdTime}</Text>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.transcriptionBody}>
                    <Text style={styles.transcriptionDate}>{formatDateTime(createdAt)}</Text>
                    <TranscriptSection title="Résumé / points importants" text={valueOf(item, "summary", "Summary")} fallback="Résumé indisponible." styles={styles} />
                    <TranscriptSection title="Tâches" text={valueOf(item, "tasks", "Tasks")} fallback="Aucune tâche détectée." styles={styles} />
                    <TranscriptSection title="Transcription" text={valueOf(item, "transcriptText", "TranscriptText")} fallback="Transcription vide." styles={styles} />
                  </View>
                )}
              </View>
            );
          }) : (
            <View style={styles.emptyTranscript}><Ionicons name="document-text-outline" size={34} color={colors.textTertiary} /><Text style={styles.emptyText}>Aucune transcription pour cette réunion.</Text></View>
          )}
        </View>
      </ScrollView>

      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scanner}>
          <CameraView style={StyleSheet.absoluteFillObject} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={scanning ? undefined : handleQrScanned} />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerTitle}>Scanner le QR de {roomName}</Text>
            <View style={styles.qrFrame} />
            {scanning && <ActivityIndicator size="large" color="#fff" />}
            <TouchableOpacity style={styles.closeScanner} onPress={() => setScannerVisible(false)}><Ionicons name="close" size={22} color="#fff" /><Text style={styles.closeScannerText}>Fermer</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

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

function InfoRow({ icon, label, value, styles, colors }) {
  return <View style={styles.infoRow}><Ionicons name={icon} size={17} color={colors.textTertiary} /><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function ActionButton({ icon, label, onPress, styles }) {
  return <TouchableOpacity style={styles.primaryButton} onPress={onPress}><Ionicons name={icon} size={20} color="#fff" /><Text style={styles.primaryButtonText}>{label}</Text></TouchableOpacity>;
}

function TranscriptSection({ title, text, fallback, styles }) {
  return <View style={styles.transcriptSection}><Text style={styles.transcriptTitle}>{title}</Text><Text style={styles.transcriptText}>{cleanMeetingText(text, fallback)}</Text></View>;
}

const createStyles = (colors, spacing, borderRadius, typography, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  hero: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  roomIcon: { width: 46, height: 46, borderRadius: borderRadius.lg, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  titleCopy: { flex: 1 },
  roomName: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.text },
  dateText: { marginTop: 2, fontSize: typography.xs, color: colors.textSecondary },
  badge: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  badgeText: { fontSize: typography.xs, fontWeight: typography.bold },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  infoLabel: { width: 68, fontSize: typography.sm, color: colors.textSecondary },
  infoValue: { flex: 1, fontSize: typography.sm, color: colors.text, fontWeight: typography.medium },
  card: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  historySection: { gap: spacing.sm },
  sectionTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.text, marginBottom: spacing.md },
  primaryButton: { minHeight: 52, borderRadius: borderRadius.lg, backgroundColor: colors.primary, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, ...shadows.sm },
  primaryButtonText: { color: "#fff", fontSize: typography.base, fontWeight: typography.bold },
  secondaryButton: { minHeight: 50, borderRadius: borderRadius.lg, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.primary, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.primary, fontSize: typography.sm, fontWeight: typography.bold, flexShrink: 1 },
  recordingStatus: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginBottom: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.errorLight || colors.surfaceMuted },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.error },
  recordingStatusCopy: { flex: 1 },
  recordingText: { color: colors.error, fontSize: typography.sm, fontWeight: typography.bold },
  recordingTimer: { marginTop: 2, color: colors.text, fontSize: typography.xl, fontWeight: typography.bold, fontVariant: ["tabular-nums"] },
  finishButton: { marginTop: spacing.md, minHeight: 50, borderRadius: borderRadius.lg, backgroundColor: colors.error, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center" },
  finishButtonText: { color: "#fff", fontSize: typography.sm, fontWeight: typography.bold },
  disabled: { opacity: 0.6 },
  transcriptionCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...shadows.sm },
  transcriptionHeader: { minHeight: 54, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  transcriptionHeaderText: { flex: 1, color: colors.text, fontSize: typography.base, fontWeight: typography.bold },
  transcriptionBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  transcriptionDate: { color: colors.textTertiary, fontSize: typography.xs, marginTop: spacing.md },
  transcriptSection: { paddingTop: spacing.md, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  transcriptTitle: { color: colors.text, fontSize: typography.base, fontWeight: typography.bold, marginBottom: spacing.sm },
  transcriptText: { color: colors.textSecondary, fontSize: typography.sm, lineHeight: 21 },
  emptyTranscript: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { color: colors.textSecondary, fontSize: typography.sm, lineHeight: 20 },
  scanner: { flex: 1, backgroundColor: "#000" },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center", gap: spacing.lg },
  scannerTitle: { color: "#fff", fontSize: typography.lg, fontWeight: typography.bold, textAlign: "center" },
  qrFrame: { width: 240, height: 240, borderWidth: 3, borderColor: "#fff", borderRadius: 24 },
  closeScanner: { position: "absolute", bottom: 48, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  closeScannerText: { color: "#fff", fontWeight: typography.bold },
});
