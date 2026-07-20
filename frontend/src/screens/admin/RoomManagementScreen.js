import logger from "../../utils/logger";
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { adminRoomService } from "../../services/api/adminRoomService";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useRef } from "react";
/* ══════════════════════════════════
   Edit/Add Modal
══════════════════════════════════ */
const EditRoomModal = ({
  visible,
  room,
  onClose,
  onSave,
  colors,
  spacing,
  typography,
  borderRadius,
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState("1");
  const [capacity, setCapacity] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const getTypeFromString = (typeStr) => {
    switch ((typeStr || "").toLowerCase()) {
      case "meeting":
        return 1;
      case "conference":
        return 2;
      case "training":
      case "formation":
        return 3;
      case "break":
        return 4;
      case "office":
        return 5;
      default:
        return 1;
    }
  };

  React.useEffect(() => {
    if (visible) {
      setName(room?.name ?? room?.Name ?? "");
      setType(String(getTypeFromString(room?.type ?? room?.Type ?? "meeting")));
      setCapacity(String(room?.capacity ?? room?.Capacity ?? ""));
      setIsActive(room ? (room?.isActive ?? room?.IsActive ?? true) : true);
    }
  }, [visible, room]);

  const handleSave = async () => {
    const cap = Number(capacity);
    if (isNaN(cap) || cap <= 0) {
      Alert.alert("Validation", "Capacité invalide.");
      return;
    }
    setSaving(true);
    try {
      const dto = {
        name: name.trim(),
        type: Number(type),
        capacity: cap,
        isActive,
      };
      logger.debug("📤 Update DTO:", dto, "ID:", room?.id ?? room?.Id);
      await onSave(room?.id ?? room?.Id, dto);
      onClose();
    } catch (error) {
      Alert.alert(
        "Erreur",
        error?.message || "Impossible de sauvegarder la salle.",
      );
    } finally {
      setSaving(false);
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: spacing.xl,
          paddingBottom: 36,
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: "center",
          marginBottom: spacing.lg,
        },
        title: {
          fontSize: typography.lg,
          fontWeight: typography.semibold,
          color: colors.text,
          marginBottom: spacing.lg,
        },
        label: {
          fontSize: typography.sm,
          fontWeight: typography.medium,
          color: colors.textSecondary,
          marginBottom: 6,
        },
        input: {
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: typography.base,
          color: colors.text,
          marginBottom: spacing.md,
        },
        btnRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
        cancel: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          borderRadius: borderRadius.lg,
          borderWidth: 1.5,
          borderColor: colors.border,
        },
        cancelTxt: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.textSecondary,
        },
        save: {
          flex: 2,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.primary,
        },
        saveTxt: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: "#fff",
        },
        statusToggle: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: spacing.md,
          gap: 10,
        },
      }),
    [colors, spacing, typography, borderRadius],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.overlay}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>
            {room ? "Modifier la salle" : "Ajouter une salle"}
          </Text>

          <Text style={s.label}>Nom de la salle</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex: Salle de conférence A"
            placeholderTextColor={colors.placeholder}
            editable={!saving}
          />

          <Text style={s.label}>Capacité (personnes)</Text>
          <TextInput
            style={s.input}
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="numeric"
            placeholder="ex. 10"
            placeholderTextColor={colors.placeholder}
            editable={!saving}
          />

          {room && (
            <TouchableOpacity
              style={s.statusToggle}
              onPress={() => setIsActive(!isActive)}
            >
              <Ionicons
                name={isActive ? "checkbox" : "square-outline"}
                size={24}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <Text style={s.label}>Salle Active</Text>
            </TouchableOpacity>
          )}

          <View style={s.btnRow}>
            <TouchableOpacity
              style={s.cancel}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={s.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.save}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.saveTxt}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const RoomCreatedModal = ({
  visible,
  roomName,
  onClose,
  title = "Salle ajoutée !",
  message = "La nouvelle salle a été enregistrée avec succès.",
  iconName = "checkmark",
  accentColor = "#10B981",
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
}) => {
  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xl,
          backgroundColor: "rgba(15, 23, 42, 0.62)",
        },
        card: {
          width: "100%",
          maxWidth: 380,
          alignItems: "center",
          paddingHorizontal: spacing.xl,
          paddingTop: 30,
          paddingBottom: spacing.xl,
          borderRadius: 28,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.lg,
        },
        iconHalo: {
          width: 88,
          height: 88,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 44,
          marginBottom: spacing.lg,
          backgroundColor: `${accentColor}20`,
        },
        iconCircle: {
          width: 62,
          height: 62,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 31,
          backgroundColor: accentColor,
        },
        title: {
          color: colors.text,
          fontSize: 22,
          fontWeight: typography.bold,
          textAlign: "center",
        },
        message: {
          marginTop: 8,
          color: colors.textSecondary,
          fontSize: typography.base,
          lineHeight: 23,
          textAlign: "center",
        },
        roomChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginTop: spacing.lg,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: borderRadius.full,
          backgroundColor: `${colors.primary}12`,
        },
        roomName: {
          flexShrink: 1,
          color: colors.primary,
          fontSize: typography.sm,
          fontWeight: typography.semibold,
        },
        button: {
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          marginTop: spacing.xl,
          paddingVertical: 14,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.primary,
        },
        buttonText: {
          color: "#FFFFFF",
          fontSize: typography.base,
          fontWeight: typography.semibold,
        },
      }),
    [colors, spacing, typography, borderRadius, shadows, accentColor],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.card} accessibilityViewIsModal>
          <View style={s.iconHalo}>
            <View style={s.iconCircle}>
              <Ionicons name={iconName} size={36} color="#FFFFFF" />
            </View>
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          {!!roomName && (
            <View style={s.roomChip}>
              <Ionicons
                name="business-outline"
                size={17}
                color={colors.primary}
              />
              <Text style={s.roomName} numberOfLines={1}>
                {roomName}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={s.button}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer la confirmation"
          >
            <Text style={s.buttonText}>Terminé</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const DeleteRoomModal = ({
  room,
  deleting,
  onCancel,
  onConfirm,
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
}) => {
  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xl,
          backgroundColor: "rgba(15, 23, 42, 0.62)",
        },
        card: {
          width: "100%",
          maxWidth: 380,
          alignItems: "center",
          padding: spacing.xl,
          borderRadius: 28,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.lg,
        },
        iconHalo: {
          width: 78,
          height: 78,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 39,
          marginBottom: spacing.lg,
          backgroundColor: "rgba(239, 68, 68, 0.12)",
        },
        title: {
          color: colors.text,
          fontSize: 22,
          fontWeight: typography.bold,
          textAlign: "center",
        },
        message: {
          marginTop: 8,
          color: colors.textSecondary,
          fontSize: typography.base,
          lineHeight: 23,
          textAlign: "center",
        },
        roomName: {
          color: colors.text,
          fontWeight: typography.semibold,
        },
        warning: {
          marginTop: spacing.md,
          color: "#EF4444",
          fontSize: typography.sm,
          fontWeight: typography.medium,
          textAlign: "center",
        },
        actions: {
          width: "100%",
          flexDirection: "row",
          gap: 10,
          marginTop: spacing.xl,
        },
        button: {
          flex: 1,
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: borderRadius.lg,
        },
        cancelButton: {
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        deleteButton: { backgroundColor: "#EF4444" },
        cancelText: {
          color: colors.textSecondary,
          fontSize: typography.base,
          fontWeight: typography.semibold,
        },
        deleteText: {
          color: "#FFFFFF",
          fontSize: typography.base,
          fontWeight: typography.semibold,
        },
      }),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const roomName = room?.name ?? room?.Name ?? "cette salle";

  return (
    <Modal
      visible={!!room}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={deleting ? undefined : onCancel}
    >
      <View style={s.overlay}>
        <View style={s.card} accessibilityViewIsModal>
          <View style={s.iconHalo}>
            <Ionicons name="trash-outline" size={34} color="#EF4444" />
          </View>
          <Text style={s.title}>Supprimer la salle ?</Text>
          <Text style={s.message}>
            Vous êtes sur le point de supprimer{" "}
            <Text style={s.roomName}>{roomName}</Text>.
          </Text>
          <Text style={s.warning}>Cette action est irréversible.</Text>
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.button, s.cancelButton]}
              onPress={onCancel}
              disabled={deleting}
            >
              <Text style={s.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.button, s.deleteButton, deleting && { opacity: 0.7 }]}
              onPress={onConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={s.deleteText}>Supprimer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const RoomManagementScreen = () => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const qrRef = useRef();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [createdRoomName, setCreatedRoomName] = useState("");
  const [qrGeneratedRoomName, setQrGeneratedRoomName] = useState("");
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadRooms = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await adminRoomService.getAllRooms();
      const loadedRooms = adminRoomService.extractData(res) || [];
      setRooms(loadedRooms);
    } catch {
      Alert.alert("Erreur", "Impossible de charger les salles.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRooms();
    }, []),
  );

  const handlePrint = async () => {
    try {
      const uri = await qrRef.current.capture();

      const base64 = await fetch(uri)
        .then((res) => res.blob())
        .then((blob) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        });

      const html = `
<html>
  <body style="text-align:center; padding-top:50px; font-family:sans-serif;">
    <h2 style="margin-bottom:20px;">${selectedQrRoom?.name}</h2>
    <img src="${base64}" style="width:220px;height:220px;" />
    <p style="margin-top:20px;">Scannez pour accéder à la salle</p>
    <p style="font-size:12px; color:gray;">ID: ${selectedQrRoom?.id}</p>
  </body>
</html>
`;

      await Print.printAsync({ html });
    } catch (err) {
      Alert.alert("Erreur", "Impossible d'imprimer.");
    }
  };

  const handleDownload = async () => {
    try {
      const uri = await qrRef.current.capture();
      await Sharing.shareAsync(uri);
    } catch (error) {
      logger.debug("Share QR error:", error);
      Alert.alert("Erreur", "Impossible de partager le QR.");
    }
  };

  const handleSave = async (id, dto) => {
    if (id) {
      await adminRoomService.updateRoom(id, dto);
      await loadRooms(true);
    } else {
      const res = await adminRoomService.createRoom(dto);
      const created = adminRoomService.extractData(res);
      await loadRooms(true);
      setCreatedRoomName(created?.name ?? created?.Name ?? dto.name);
    }
  };

  const handleDelete = (room) => {
    setRoomToDelete(room);
  };

  const confirmDelete = async () => {
    const id = roomToDelete?.id ?? roomToDelete?.Id;
    if (id == null) return;

    setDeletingId(id);
    try {
      await adminRoomService.deleteRoom(id);
      setRoomToDelete(null);
      await loadRooms(true);
    } catch (error) {
      Alert.alert(
        "Suppression impossible",
        error?.message || "Impossible de supprimer la salle.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedQrRoom, setSelectedQrRoom] = useState(null);

  const handleGenerateQr = async (room) => {
    const roomId = room.id ?? room.Id;
    try {
      await adminRoomService.generateQr(roomId);
      setQrGeneratedRoomName(room.name ?? room.Name ?? "Salle");
      loadRooms(true);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de générer le QR.");
    }
  };

  const showQr = (room) => {
    setSelectedQrRoom(room);
    setQrModalVisible(true);
  };

  const renderRoomCard = (room) => {
    const id = room.id ?? room.Id;
    const name = room.name ?? room.Name ?? "—";
    const capacity = room.capacity ?? room.Capacity ?? "—";
    const isActive = room.isActive ?? room.IsActive ?? false;
    const isDeleting = deletingId === id;
    const hasQr = room.qrData || room.QrData;

    return (
      <View key={id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View
            style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}
          >
            <Ionicons name="business" size={20} color={colors.primary} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.roomName} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isActive ? "#D1FAE5" : "#FEE2E2" },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: isActive ? "#065F46" : "#991B1B" },
              ]}
            >
              {isActive ? "Actif" : "Inactif"}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="people" size={14} color={colors.textSecondary} />
            <Text style={styles.infoText}>Capacité: {capacity}</Text>
          </View>
          {hasQr && (
            <View style={styles.infoItem}>
              <Ionicons name="qr-code" size={14} color={colors.success} />
              <Text style={[styles.infoText, { color: colors.success }]}>
                QR prêt
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => {
              setEditRoom(room);
              setModalVisible(true);
            }}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>
              Modifier
            </Text>
          </TouchableOpacity>
          {!hasQr ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => handleGenerateQr(room)}
            >
              <Ionicons
                name="qr-code-outline"
                size={16}
                color={colors.warning}
              />
              <Text style={[styles.actionBtnText, { color: colors.warning }]}>
                QR
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => showQr(room)}
            >
              <Ionicons name="qr-code" size={16} color={colors.success} />
              <Text style={[styles.actionBtnText, { color: colors.success }]}>
                Voir QR
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.deleteBtn, isDeleting && { opacity: 0.5 }]}
            onPress={() => handleDelete(room)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            )}
            <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>
              Supprimer
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Salles ({rooms.length})</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setEditRoom(null);
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRooms(true)}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : rooms.length === 0 ? (
          <Text style={styles.emptyText}>Aucune salle trouvée.</Text>
        ) : (
          rooms.map(renderRoomCard)
        )}
      </ScrollView>

      <EditRoomModal
        visible={isModalVisible}
        room={editRoom}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
      />

      <RoomCreatedModal
        visible={!!createdRoomName}
        roomName={createdRoomName}
        onClose={() => setCreatedRoomName("")}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
        shadows={shadows}
      />

      <DeleteRoomModal
        room={roomToDelete}
        deleting={deletingId != null}
        onCancel={() => setRoomToDelete(null)}
        onConfirm={confirmDelete}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
        shadows={shadows}
      />

      <RoomCreatedModal
        visible={!!qrGeneratedRoomName}
        roomName={qrGeneratedRoomName}
        onClose={() => setQrGeneratedRoomName("")}
        title="QR code généré !"
        message="Le QR permanent de la salle est prêt à être utilisé."
        iconName="qr-code"
        accentColor={colors.primary}
        colors={colors}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
        shadows={shadows}
      />

      <Modal visible={qrModalVisible} transparent animationType="slide">
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setQrModalVisible(false)}
        />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.8)",
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              padding: 20,
              borderRadius: 16,
              alignItems: "center",
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}
            >
              QR Permanent - {selectedQrRoom?.name}
            </Text>
            <ViewShot ref={qrRef} options={{ format: "png", quality: 1 }}>
              {(selectedQrRoom?.qrData || selectedQrRoom?.QrData) && (
                <Image
                  source={{
                    uri: `data:image/png;base64,${selectedQrRoom.qrData || selectedQrRoom.QrData}`,
                  }}
                  style={{ width: 200, height: 200 }}
                />
              )}
            </ViewShot>
            <Text style={{ marginTop: 10, fontSize: 12, textAlign: "center" }}>
              Imprimez ou partagez ce QR. Il identifie la salle #
              {selectedQrRoom?.id}.
            </Text>
            <TouchableOpacity
              style={{
                marginTop: 10,
                padding: 10,
                backgroundColor: "#10B981",
                borderRadius: 8,
              }}
              onPress={handlePrint}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                🖨️ Imprimer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                marginTop: 10,
                padding: 10,
                backgroundColor: "#6366F1",
                borderRadius: 8,
              }}
              onPress={handleDownload}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                📥 Télécharger
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                marginTop: 15,
                padding: 10,
                backgroundColor: "#007AFF",
                borderRadius: 8,
              }}
              onPress={() => setQrModalVisible(false)}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: borderRadius.md,
      gap: 4,
    },
    addBtnText: { color: "#fff", fontWeight: typography.semibold },
    list: { flex: 1 },
    listContent: { padding: spacing.lg, gap: 12, paddingBottom: 40 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: spacing.md,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    cardHeaderText: { flex: 1 },
    roomName: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },
    roomLocation: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
    },
    statusText: { fontSize: 11, fontWeight: typography.semibold },
    infoRow: { flexDirection: "row", gap: 12, marginBottom: spacing.md },
    infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    infoText: { fontSize: typography.sm, color: colors.textSecondary },
    actionsRow: {
      flexDirection: "row",
      gap: 10,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    editBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    deleteBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: "#EF4444",
      backgroundColor: "rgba(239,68,68,0.08)",
    },
    actionBtnText: { fontSize: typography.sm, fontWeight: typography.semibold },
    emptyText: {
      textAlign: "center",
      color: colors.textSecondary,
      marginTop: 40,
    },
  });

export default RoomManagementScreen;
