import logger from "../../utils/logger";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { announcementService } from "../../services/api/announcementService";

const emptyForm = {
  title: "",
  content: "",
  publishDate: "",
  publishTime: "",
  expiryDate: "",
  expiryTime: "",
  imageFile: null,
};

const TUNISIA_TIME_ZONE = "Africa/Tunis";
const TUNISIA_UTC_OFFSET_MINUTES = 60;

const getTunisiaParts = (date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TUNISIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
};

const parseApiInstant = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const hasOffset = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
    return new Date(hasOffset ? value : `${value}Z`);
  }
  return new Date(value);
};

const makeTunisiaInstant = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);

  if ([year, month, day, hour, minute].some((part) => Number.isNaN(part))) {
    return null;
  }

  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, 0, 0) -
      TUNISIA_UTC_OFFSET_MINUTES * 60000,
  );
};

const formatTunisiaLocalDateTimePayload = (dateValue, timeValue) =>
  dateValue && timeValue ? `${dateValue}T${timeValue}:00` : null;

const ManageAnnouncementsScreen = () => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [successFeedback, setSuccessFeedback] = useState(null);

  const [schedulePublish, setSchedulePublish] = useState(false);
  const [autoExpire, setAutoExpire] = useState(false);

  const [form, setForm] = useState(emptyForm);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerField, setPickerField] = useState(null);

  const loadAnnouncements = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await announcementService.getManageAnnouncements();
      if (!res?.success) {
        throw new Error(res?.message || "Impossible de charger les annonces.");
      }

      setAnnouncements(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      const message =
        error?.data?.message ||
        error?.message ||
        "Impossible de charger les annonces.";

      logger.debug("MANAGE ANNOUNCEMENTS LOAD ERROR:", {
        message: error?.message,
        status: error?.status,
        data: error?.data,
        url: error?.url,
        baseURL: error?.baseURL,
      });

      Alert.alert("Erreur", message);
      setAnnouncements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAnnouncements();
    }, [loadAnnouncements]),
  );

  const { liveItems, scheduledItems, expiredItems } = useMemo(() => {
    const now = new Date();
    const live = [];
    const scheduled = [];
    const expired = [];

    announcements.forEach((item) => {
      const publishAt = item.publishAt ?? item.PublishAt ?? null;
      const expiresAt = item.expiresAt ?? item.ExpiresAt ?? null;
      const publishDate = publishAt ? parseApiInstant(publishAt) : null;
      const expiryDate = expiresAt ? parseApiInstant(expiresAt) : null;

      if (expiryDate && expiryDate <= now) expired.push(item);
      else if (publishDate && publishDate > now) scheduled.push(item);
      else live.push(item);
    });

    return { liveItems: live, scheduledItems: scheduled, expiredItems: expired };
  }, [announcements]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setSchedulePublish(false);
    setAutoExpire(false);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSchedulePublish(false);
    setAutoExpire(false);
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setEditingId(item.id ?? item.Id);

    const publishAt = item.publishAt ?? item.PublishAt ?? "";
    const expiresAt = item.expiresAt ?? item.ExpiresAt ?? "";

    setForm({
      title: item.title ?? item.Title ?? "",
      content: item.content ?? item.Content ?? "",
      publishDate: publishAt ? formatDatePart(publishAt) : "",
      publishTime: publishAt ? formatTimePart(publishAt) : "",
      expiryDate: expiresAt ? formatDatePart(expiresAt) : "",
      expiryTime: expiresAt ? formatTimePart(expiresAt) : "",
      imageFile: null,
    });

    setSchedulePublish(!!publishAt);
    setAutoExpire(!!expiresAt);
    setShowForm(true);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission refusée",
          "Veuillez autoriser l'accès à la galerie.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        const asset = result.assets[0];

        setForm((prev) => ({
          ...prev,
          imageFile: {
            uri: asset.uri,
            name: asset.fileName || "announcement.jpg",
            type: asset.mimeType || "image/jpeg",
          },
        }));
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de sélectionner l'image.");
    }
  };

  const removeImage = () => {
    setForm((prev) => ({
      ...prev,
      imageFile: null,
    }));
  };

  const openDatePicker = (field) => {
    setPickerField(field);
    setShowDatePicker(true);
  };

  const openTimePicker = (field) => {
    setPickerField(field);
    setShowTimePicker(true);
  };

  const validateForm = () => {
    if (!form.title.trim()) {
      Alert.alert("Validation", "Le titre est obligatoire.");
      return false;
    }

    if (!form.content.trim()) {
      Alert.alert("Validation", "Le contenu est obligatoire.");
      return false;
    }

    if (schedulePublish && (!form.publishDate || !form.publishTime)) {
      Alert.alert(
        "Validation",
        "Veuillez choisir la date et l'heure de publication.",
      );
      return false;
    }

    if (autoExpire && (!form.expiryDate || !form.expiryTime)) {
      Alert.alert(
        "Validation",
        "Veuillez choisir la date et l'heure d'expiration.",
      );
      return false;
    }

    const publishAtValue = schedulePublish
      ? makeTunisiaInstant(form.publishDate, form.publishTime)
      : null;

    const expiresAtValue = autoExpire
      ? makeTunisiaInstant(form.expiryDate, form.expiryTime)
      : null;

    if (publishAtValue && expiresAtValue && expiresAtValue <= publishAtValue) {
      Alert.alert(
        "Validation",
        "L'heure d'expiration doit Ãªtre aprÃ¨s l'heure de publication.",
      );
      return false;
    }

    return true;
  };

  const saveAnnouncement = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        publishAt:
          schedulePublish && form.publishDate && form.publishTime
            ? formatTunisiaLocalDateTimePayload(
                form.publishDate,
                form.publishTime,
              )
            : null,
        expiresAt:
          autoExpire && form.expiryDate && form.expiryTime
            ? formatTunisiaLocalDateTimePayload(
                form.expiryDate,
                form.expiryTime,
              )
            : null,
      };

      if (editingId) {
        await announcementService.updateAnnouncement(editingId, payload);
        setSuccessFeedback({
          title: "Annonce modifi\u00e9e",
          message:
            "Les modifications de l\u2019annonce ont \u00e9t\u00e9 enregistr\u00e9es avec succ\u00e8s.",
        });
      } else {
        const formData = new FormData();

        formData.append("title", payload.title);
        formData.append("content", payload.content);

        if (payload.publishAt) {
          formData.append("publishAt", payload.publishAt);
        }

        if (payload.expiresAt) {
          formData.append("expiresAt", payload.expiresAt);
        }

        if (form.imageFile) {
          formData.append("image", {
            uri: form.imageFile.uri,
            name: form.imageFile.name,
            type: form.imageFile.type,
          });
        }

        await announcementService.createAnnouncement(formData);
        setSuccessFeedback({
          title: "Annonce publi\u00e9e",
          message: "L\u2019annonce a \u00e9t\u00e9 publi\u00e9e avec succ\u00e8s.",
        });
      }

      resetForm();
      await loadAnnouncements();
    } catch (error) {
      logger.debug("SAVE ANNOUNCEMENT ERROR:", error?.response?.data || error);

      Alert.alert(
        "Erreur",
        error?.response?.data?.message ||
          "Impossible d'enregistrer l'annonce.",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item) => {
    setDeleteTarget(item);
  };

  const deleteAnnouncement = async (id) => {
    try {
      setDeletingId(id);
      await announcementService.deleteAnnouncement(id);

      setAnnouncements((prev) =>
        prev.filter((item) => (item.id ?? item.Id) !== id),
      );
      setDeleteTarget(null);
    } catch {
      Alert.alert("Erreur", "Impossible de supprimer l'annonce.");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatus = (publishAt, expiresAt) => {
    const now = new Date();
    const publishDate = publishAt ? parseApiInstant(publishAt) : null;
    const expiryDate = expiresAt ? parseApiInstant(expiresAt) : null;

    if (expiryDate && expiryDate <= now) return "expired";
    if (publishDate && publishDate > now) return "scheduled";
    return "live";
  };

  const renderStatusBadge = (status) => {
    const config = {
      live: {
        label: "Live",
        containerStyle: styles.badgeLive,
        textStyle: styles.badgeLiveText,
        dotStyle: styles.dotLive,
        showDot: true,
      },
      scheduled: {
        label: "Planifiée",
        containerStyle: styles.badgeScheduled,
        textStyle: styles.badgeScheduledText,
        icon: "time-outline",
      },
      expired: {
        label: "Expirée",
        containerStyle: styles.badgeExpired,
        textStyle: styles.badgeExpiredText,
        icon: "close-circle-outline",
      },
    }[status];

    return (
      <View style={[styles.badge, config.containerStyle]}>
        {config.showDot ? (
          <View style={[styles.dot, config.dotStyle]} />
        ) : (
          <Ionicons name={config.icon} size={12} style={config.textStyle} />
        )}
        <Text style={config.textStyle}>{config.label}</Text>
      </View>
    );
  };

  const renderAnnouncement = ({ item, isExpired = false }) => {
    const id = item.id ?? item.Id;
    const title = item.title ?? item.Title ?? "Sans titre";
    const content = item.content ?? item.Content ?? "";
    const publishAt = item.publishAt ?? item.PublishAt;
    const expiresAt = item.expiresAt ?? item.ExpiresAt;
    const imageUrl = item.imageUrl ?? item.ImageUrl ?? null;
    const status = getStatus(publishAt, expiresAt);

    return (
      <View
        testID={`announcements.card.${id}`}
        style={[styles.card, isExpired && styles.cardExpired]}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : null}

        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {title}
          </Text>
          {renderStatusBadge(status)}
        </View>

        <Text style={styles.cardBody} numberOfLines={3}>
          {content}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color={colors.textSecondary}
            />
            <Text style={styles.metaText}>
              {publishAt
                ? `Publiée le ${formatDisplayDate(publishAt)}`
                : "Publication : immédiatement"}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons
              name="time-outline"
              size={13}
              color={colors.textSecondary}
            />
            <Text style={styles.metaText}>
              {expiresAt
                ? `Expire le ${formatDisplayDate(expiresAt)}`
                : "Expiration : aucune"}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            testID={`announcements.edit.${id}`}
            style={styles.btnEdit}
            onPress={() => openEditForm(item)}
            activeOpacity={0.75}
          >
            <Ionicons
              name="create-outline"
              size={15}
              color={colors.textPrimary ?? colors.text}
            />
            <Text style={styles.btnEditText}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID={`announcements.delete.${id}`}
            style={styles.btnDelete}
            onPress={() => confirmDelete(item)}
            disabled={deletingId === id}
            activeOpacity={0.75}
          >
            <Ionicons name="trash-outline" size={15} color="#B91C1C" />
            <Text style={styles.btnDeleteText}>
              {deletingId === id ? "..." : "Supprimer"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement des annonces...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <ScrollView
        testID="announcements.scrollView"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAnnouncements(true)}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          testID="announcements.openCreateButton"
          style={styles.fab}
          onPress={openCreateForm}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.fabText}>Nouvelle annonce</Text>
        </TouchableOpacity>

          <View style={styles.statsRow}>
          <View testID="announcements.stats.live" style={styles.statCard}>
            <View style={[styles.statDot, { backgroundColor: "#16A34A" }]} />
            <Text style={styles.statValue}>{liveItems.length}</Text>
            <Text style={styles.statLabel}>En ligne</Text>
          </View>

          <View testID="announcements.stats.scheduled" style={styles.statCard}>
            <View style={[styles.statDot, { backgroundColor: "#1D4ED8" }]} />
            <Text style={styles.statValue}>{scheduledItems.length}</Text>
            <Text style={styles.statLabel}>Planifiée</Text>
          </View>

          <View testID="announcements.stats.expired" style={styles.statCard}>
            <View style={[styles.statDot, { backgroundColor: "#6B7280" }]} />
            <Text style={styles.statValue}>{expiredItems.length}</Text>
            <Text style={styles.statLabel}>Expirée</Text>
          </View>
        </View>

        {liveItems.length > 0 || scheduledItems.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Publiées & planifiées</Text>
            {[...liveItems, ...scheduledItems].map((item) => (
              <View key={String(item.id ?? item.Id)}>
                {renderAnnouncement({ item })}
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="megaphone-outline"
                size={28}
                color={colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>Aucune annonce active</Text>

            <Text style={styles.emptySubtitle}>
              Créez votre première annonce pour informer l' équipe.
            </Text>
          </View>
        )}

        {expiredItems.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>Expirées</Text>

            {expiredItems.map((item) => (
              <View key={String(item.id ?? item.Id)}>
                {renderAnnouncement({ item, isExpired: true })}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal
        testID="announcements.formModal"
        visible={showForm}
        animationType="fade"
        transparent
        onRequestClose={saving ? () => {} : resetForm}
      >
        <KeyboardAvoidingView
          style={styles.sheetKeyboard}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderText}>
                <Text style={styles.sheetTitle}>
                  {editingId ? "Modifier l\u2019annonce" : "Cr\u00e9er une annonce"}
                </Text>

                <Text style={styles.sheetSubtitle}>
                  Visible immédiatement ou selon un calendrier
                </Text>
              </View>

              <TouchableOpacity
                testID="announcements.closeFormButton"
                style={styles.closeBtn}
                onPress={resetForm}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={colors.textPrimary ?? colors.text}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              testID="announcements.formScrollView"
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.fieldLabel}>Titre</Text>
              <TextInput
                testID="announcements.titleInput"
                value={form.title}
                onChangeText={(t) => handleChange("title", t)}
                placeholder="ex. Fermeture bureau vendredi"
                placeholderTextColor={colors.textSecondary}
                style={styles.fieldInput}
              />

              <Text style={styles.fieldLabel}>Contenu</Text>
              <TextInput
                testID="announcements.contentInput"
                value={form.content}
                onChangeText={(t) => handleChange("content", t)}
                placeholder="Rédigez votre annonce ici…"
                placeholderTextColor={colors.textSecondary}
                style={[styles.fieldInput, styles.fieldTextarea]}
                multiline
                textAlignVertical="top"
              />

              {!editingId && (
                <>
                  <Text style={styles.fieldLabel}>Image optionnelle</Text>

                  <TouchableOpacity
                    testID="announcements.imagePickerButton"
                    style={styles.imagePickerButton}
                    onPress={pickImage}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="image-outline"
                      size={18}
                      color={colors.primary}
                    />

                    <Text style={styles.imagePickerText}>
                      {form.imageFile ? "Changer l'image" : "Ajouter une image"}
                    </Text>
                  </TouchableOpacity>

                  {form.imageFile && (
                    <View style={styles.previewImageWrap}>
                      <Image
                        source={{ uri: form.imageFile.uri }}
                        style={styles.previewImage}
                        resizeMode="cover"
                      />

                      <TouchableOpacity
                        testID="announcements.removeImageButton"
                        style={styles.removeImageButton}
                        onPress={removeImage}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {editingId && (
                <View style={styles.editImageNotice}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.editImageNoticeText}>
                    La modification de l'image sera ajoutée plus tard. Cette
                    version garde l'image actuelle.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                testID="announcements.scheduleToggle"
                style={styles.toggleRow}
                onPress={() => setSchedulePublish((v) => !v)}
                activeOpacity={0.8}
              >
                <View style={styles.toggleText}>
                  <Text style={styles.toggleTitle}>
                    Planifier la publication
                  </Text>
                  <Text style={styles.toggleSubtitle}>
                    Rendre visible plus tard
                  </Text>
                </View>

                <Switch
                  value={schedulePublish}
                  onValueChange={setSchedulePublish}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </TouchableOpacity>

              {schedulePublish && (
                <View style={styles.dateSection}>
                  <View style={styles.dateGrid}>
                    <View style={styles.dateGridItem}>
                      <Text style={styles.fieldLabelSmall}>Date</Text>

                      <TouchableOpacity
                        testID="announcements.publishDateButton"
                        style={styles.pickerInput}
                        onPress={() => openDatePicker("publishDate")}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.pickerInputText,
                            !form.publishDate && styles.pickerPlaceholder,
                          ]}
                        >
                          {form.publishDate || "Choisir date"}
                        </Text>

                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.dateGridItem}>
                      <Text style={styles.fieldLabelSmall}>Heure</Text>

                      <TouchableOpacity
                        testID="announcements.publishTimeButton"
                        style={styles.pickerInput}
                        onPress={() => openTimePicker("publishTime")}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.pickerInputText,
                            !form.publishTime && styles.pickerPlaceholder,
                          ]}
                        >
                          {form.publishTime || "Choisir heure"}
                        </Text>

                        <Ionicons
                          name="time-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {form.publishDate && form.publishTime ? (
                    <View style={styles.previewChip}>
                      <Ionicons name="time-outline" size={13} color="#1D4ED8" />
                      <Text style={styles.previewChipText}>
                        Publication le {formatPrettyDate(form.publishDate)} Ã {" "}
                        {formatPrettyTime(form.publishTime)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              <TouchableOpacity
                testID="announcements.expiryToggle"
                style={[styles.toggleRow, { marginTop: spacing.sm }]}
                onPress={() => setAutoExpire((v) => !v)}
                activeOpacity={0.8}
              >
                <View style={styles.toggleText}>
                  <Text style={styles.toggleTitle}>
                    Suppression automatique
                  </Text>
                  <Text style={styles.toggleSubtitle}>
                    Masquer aprÃ¨s une date
                  </Text>
                </View>

                <Switch
                  value={autoExpire}
                  onValueChange={setAutoExpire}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </TouchableOpacity>

              {autoExpire && (
                <View style={styles.dateSection}>
                  <View style={styles.dateGrid}>
                    <View style={styles.dateGridItem}>
                      <Text style={styles.fieldLabelSmall}>Date</Text>

                      <TouchableOpacity
                        testID="announcements.expiryDateButton"
                        style={styles.pickerInput}
                        onPress={() => openDatePicker("expiryDate")}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.pickerInputText,
                            !form.expiryDate && styles.pickerPlaceholder,
                          ]}
                        >
                          {form.expiryDate || "Choisir date"}
                        </Text>

                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.dateGridItem}>
                      <Text style={styles.fieldLabelSmall}>Heure</Text>

                      <TouchableOpacity
                        testID="announcements.expiryTimeButton"
                        style={styles.pickerInput}
                        onPress={() => openTimePicker("expiryTime")}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.pickerInputText,
                            !form.expiryTime && styles.pickerPlaceholder,
                          ]}
                        >
                          {form.expiryTime || "Choisir heure"}
                        </Text>

                        <Ionicons
                          name="time-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {form.expiryDate && form.expiryTime ? (
                    <View style={[styles.previewChip, styles.previewChipExpiry]}>
                      <Ionicons
                        name="hourglass-outline"
                        size={13}
                        color="#B91C1C"
                      />
                      <Text
                        style={[styles.previewChipText, { color: "#B91C1C" }]}
                      >
                        Expiration le {formatPrettyDate(form.expiryDate)} Ã {" "}
                        {formatPrettyTime(form.expiryTime)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </ScrollView>

            <View style={styles.formActions}>
              <TouchableOpacity
                testID="announcements.cancelButton"
                style={styles.btnSecondary}
                onPress={resetForm}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="announcements.submitButton"
                style={[styles.btnPrimary, saving && styles.btnDisabled]}
                onPress={saveAnnouncement}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>
                    {editingId ? "Enregistrer" : "Publier"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={getPickerValue(form, pickerField)}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);

                  if (event.type === "dismissed" || !selectedDate) return;

                  handleChange(pickerField, formatDateFromDate(selectedDate));
                }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={getPickerValue(form, pickerField)}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowTimePicker(false);

                  if (event.type === "dismissed" || !selectedTime) return;

                  handleChange(pickerField, formatTimeFromDate(selectedTime));
                }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        testID="announcements.successModal"
        visible={!!successFeedback}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessFeedback(null)}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Ionicons
                name="checkmark-circle"
                size={42}
                color={colors.primary}
              />
            </View>

            <Text style={styles.successTitle}>{successFeedback?.title}</Text>
            <Text style={styles.successMessage}>{successFeedback?.message}</Text>

            <TouchableOpacity
              testID="announcements.successDoneButton"
              style={styles.successButton}
              onPress={() => setSuccessFeedback(null)}
              activeOpacity={0.9}
            >
              <Text style={styles.successButtonText}>Terminer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        testID="announcements.deleteModal"
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingId) setDeleteTarget(null);
        }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="warning" size={34} color={colors.error} />
            </View>

            <Text style={styles.confirmTitle}>{"Supprimer l\u2019annonce"}</Text>
            <Text style={styles.confirmMessage}>
              {"Voulez-vous vraiment supprimer cette annonce ? Cette action est irr\u00e9versible."}
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                testID="announcements.deleteCancelButton"
                style={styles.confirmSecondaryButton}
                onPress={() => setDeleteTarget(null)}
                disabled={!!deletingId}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmSecondaryText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="announcements.deleteConfirmButton"
                style={[
                  styles.confirmDangerButton,
                  deletingId && styles.btnDisabled,
                ]}
                onPress={() =>
                  deleteAnnouncement(deleteTarget?.id ?? deleteTarget?.Id)
                }
                disabled={!!deletingId}
                activeOpacity={0.85}
              >
                {deletingId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmDangerText}>Supprimer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

function getPickerValue(form, field) {
  if (!field) return new Date();

  const value = form[field];

  if (!value) return new Date();

  if (field.includes("Date")) {
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  if (field.includes("Time")) {
    const [hours, minutes] = value.split(":");
    const d = new Date();
    d.setHours(Number(hours || 0), Number(minutes || 0), 0, 0);
    return d;
  }

  return new Date();
}

function combineDateTime(dateValue, timeValue) {
  return makeTunisiaInstant(dateValue, timeValue);
}

function formatDateFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTimeFromDate(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function formatDisplayDate(value) {
  const d = parseApiInstant(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return `${d.toLocaleDateString("fr-FR", {
    timeZone: TUNISIA_TIME_ZONE,
  })} ${d.toLocaleTimeString("fr-FR", {
    timeZone: TUNISIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatPrettyDate(dateValue) {
  if (!dateValue) return "â€”";

  const d = new Date(`${dateValue}T12:00:00`);

  if (Number.isNaN(d.getTime())) {
    const [year, month, day] = dateValue.split("-");
    return year && month && day ? `${day}/${month}/${year}` : "â€”";
  }

  return d.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPrettyTime(timeValue) {
  if (!timeValue) return "â€”";

  const [hours, minutes] = timeValue.split(":");

  if (!hours || !minutes) return "â€”";

  const d = new Date();
  d.setHours(Number(hours), Number(minutes), 0, 0);

  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDatePart(value) {
  const d = parseApiInstant(value);
  if (Number.isNaN(d.getTime())) return "";

  const parts = getTunisiaParts(d);
  return `${parts.year}-${String(parts.month).padStart(
    2,
    "0",
  )}-${String(parts.day).padStart(2, "0")}`;
}

function formatTimePart(value) {
  const d = parseApiInstant(value);
  if (Number.isNaN(d.getTime())) return "";

  const parts = getTunisiaParts(d);
  return `${String(parts.hour).padStart(2, "0")}:${String(
    parts.minute,
  ).padStart(2, "0")}`;
}

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
    },

    topBarTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.textPrimary ?? colors.text,
    },

    topBarBadge: {
      backgroundColor: colors.primary + "15",
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },

    topBarBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },

    scrollView: {
      flex: 1,
    },

    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: 120,
    },

    fab: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingVertical: 15,
      marginBottom: spacing.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },

    fabText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "800",
    },

    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: spacing.lg,
    },

    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },

    statDot: {
      width: 9,
      height: 9,
      borderRadius: 99,
      marginBottom: 8,
    },

    statValue: {
      fontSize: 24,
      fontWeight: "900",
      color: colors.textPrimary ?? colors.text,
    },

    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: "600",
    },

    sectionLabel: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: colors.textSecondary,
      marginBottom: 10,
      marginTop: 4,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },

    cardExpired: {
      opacity: 0.65,
    },

    cardImage: {
      width: "100%",
      height: 160,
      borderRadius: 18,
      marginBottom: 12,
      backgroundColor: colors.background,
    },

    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 8,
    },

    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary ?? colors.text,
      lineHeight: 22,
    },

    cardBody: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
      marginBottom: 14,
    },

    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },

    dot: {
      width: 7,
      height: 7,
      borderRadius: 99,
    },

    dotLive: {
      backgroundColor: "#16A34A",
    },

    badgeLive: {
      backgroundColor: "#DCFCE7",
    },

    badgeLiveText: {
      fontSize: 11,
      fontWeight: "800",
      color: "#15803D",
    },

    badgeScheduled: {
      backgroundColor: "#DBEAFE",
    },

    badgeScheduledText: {
      fontSize: 11,
      fontWeight: "800",
      color: "#1D4ED8",
    },

    badgeExpired: {
      backgroundColor: "#FEE2E2",
    },

    badgeExpiredText: {
      fontSize: 11,
      fontWeight: "800",
      color: "#B91C1C",
    },

    metaRow: {
      gap: 6,
      marginBottom: 14,
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 10,
    },

    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },

    metaText: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
    },

    actionsRow: {
      flexDirection: "row",
      gap: 10,
    },

    btnEdit: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 11,
    },

    btnEditText: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.textPrimary ?? colors.text,
    },

    btnDelete: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: "#FEE2E2",
      borderRadius: 14,
      paddingVertical: 11,
      paddingHorizontal: 14,
    },

    btnDeleteText: {
      fontSize: 13,
      fontWeight: "800",
      color: "#B91C1C",
    },

    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },

    emptyState: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 22,
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },

    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary + "12",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },

    emptyTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary ?? colors.text,
      marginBottom: 6,
    },

    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 21,
    },

    loadingState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },

    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textSecondary,
    },

    sheetKeyboard: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
    },

    sheetContainer: {
      flex: 1,
      width: "100%",
      maxHeight: "92%",
      overflow: "hidden",
      backgroundColor: colors.surfaceElevated ?? colors.surface,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.lg,
    },

    sheetHandle: {
      width: 42,
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 999,
      alignSelf: "center",
      marginTop: spacing.md,
    },

    sheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    sheetHeaderText: {
      flex: 1,
    },

    sheetTitle: {
      fontSize: typography.xl,
      fontWeight: "900",
      color: colors.textPrimary ?? colors.text,
    },

    sheetSubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginTop: 4,
    },

    closeBtn: {
      width: 38,
      height: 38,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    sheetScroll: {
      flex: 1,
      minHeight: 0,
    },

    sheetScrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxxl,
    },

    fieldLabel: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.textPrimary ?? colors.text,
      marginBottom: 8,
      marginTop: spacing.lg,
    },

    fieldInput: {
      minHeight: 50,
      backgroundColor: colors.inputBackground ?? colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: typography.sm,
      color: colors.textPrimary ?? colors.text,
    },

    fieldTextarea: {
      minHeight: 150,
      lineHeight: 21,
      paddingTop: spacing.md,
    },

    imagePickerButton: {
      marginTop: spacing.xs,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 8,
    },

    imagePickerText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
    },

    previewImageWrap: {
      marginTop: 12,
      position: "relative",
      borderRadius: borderRadius.xl,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },

    previewImage: {
      width: "100%",
      height: 190,
      backgroundColor: colors.surfaceMuted,
    },

    removeImageButton: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center",
      justifyContent: "center",
    },

    editImageNotice: {
      flexDirection: "row",
      gap: 8,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      padding: 12,
      marginTop: 16,
    },

    editImageNoticeText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
    },

    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginTop: 16,
    },

    toggleText: {
      flex: 1,
    },

    toggleTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textPrimary ?? colors.text,
    },

    toggleSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },

    dateSection: {
      marginTop: 10,
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },

    dateGrid: {
      flexDirection: "row",
      gap: 10,
    },

    dateGridItem: {
      flex: 1,
    },

    fieldLabelSmall: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textSecondary,
      marginBottom: 6,
    },

    pickerInput: {
      minHeight: 48,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },

    pickerInputText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary ?? colors.text,
    },

    pickerPlaceholder: {
      color: colors.textSecondary,
      fontWeight: "500",
    },

    previewChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor: "#DBEAFE",
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 12,
      marginTop: 10,
    },

    previewChipExpiry: {
      backgroundColor: "#FEE2E2",
    },

    previewChipText: {
      flex: 1,
      fontSize: 12,
      fontWeight: "700",
      color: "#1D4ED8",
      lineHeight: 17,
    },

    formActions: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceElevated ?? colors.surface,
    },

    btnPrimary: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
      ...shadows.sm,
    },

    btnPrimaryText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "900",
    },

    btnSecondary: {
      flex: 1,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
    },

    btnSecondaryText: {
      color: colors.textPrimary ?? colors.text,
      fontSize: 15,
      fontWeight: "800",
    },

    btnDisabled: {
      opacity: 0.55,
    },

    successOverlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
    },

    successCard: {
      width: "100%",
      maxWidth: 360,
      alignItems: "center",
      backgroundColor: colors.surfaceElevated ?? colors.surface,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      ...shadows.lg,
    },

    successIconWrap: {
      width: 72,
      height: 72,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary + "18",
      marginBottom: spacing.lg,
    },

    successTitle: {
      fontSize: typography.xl,
      fontWeight: "900",
      color: colors.textPrimary ?? colors.text,
      textAlign: "center",
      marginBottom: spacing.sm,
    },

    successMessage: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 21,
      marginBottom: spacing.xl,
    },

    successButton: {
      width: "100%",
      minHeight: 48,
      borderRadius: borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      ...shadows.sm,
    },

    successButtonText: {
      fontSize: typography.base,
      fontWeight: "900",
      color: colors.textOnPrimary,
    },

    confirmOverlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },

    confirmCard: {
      width: "100%",
      maxWidth: 380,
      alignItems: "center",
      backgroundColor: colors.surfaceElevated ?? colors.surface,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      ...shadows.lg,
    },

    confirmIconWrap: {
      width: 68,
      height: 68,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.errorLight,
      marginBottom: spacing.lg,
    },

    confirmTitle: {
      fontSize: typography.xl,
      fontWeight: "900",
      color: colors.textPrimary ?? colors.text,
      textAlign: "center",
      marginBottom: spacing.sm,
    },

    confirmMessage: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 21,
      marginBottom: spacing.xl,
    },

    confirmActions: {
      flexDirection: "row",
      width: "100%",
      gap: spacing.sm,
    },

    confirmSecondaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },

    confirmDangerButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.error,
      paddingHorizontal: spacing.md,
      ...shadows.sm,
    },

    confirmSecondaryText: {
      fontSize: typography.base,
      fontWeight: "800",
      color: colors.textPrimary ?? colors.text,
    },

    confirmDangerText: {
      fontSize: typography.base,
      fontWeight: "900",
      color: colors.textOnPrimary,
    },
  });

export default ManageAnnouncementsScreen;
