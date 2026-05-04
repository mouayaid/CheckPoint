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
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
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
};

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
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setAnnouncements(data);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de charger les annonces.");
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
      const publishDate = publishAt ? new Date(publishAt) : null;
      const expiryDate = expiresAt ? new Date(expiresAt) : null;

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
    });

    setSchedulePublish(!!publishAt);
    setAutoExpire(!!expiresAt);
    setShowForm(true);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      ? combineDateTime(form.publishDate, form.publishTime)
      : null;

    const expiresAtValue = autoExpire
      ? combineDateTime(form.expiryDate, form.expiryTime)
      : null;

    if (publishAtValue && expiresAtValue && expiresAtValue <= publishAtValue) {
      Alert.alert(
        "Validation",
        "L'heure d'expiration doit être après l'heure de publication.",
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
            ? toIsoFromParts(form.publishDate, form.publishTime)
            : null,
        expiresAt:
          autoExpire && form.expiryDate && form.expiryTime
            ? toIsoFromParts(form.expiryDate, form.expiryTime)
            : null,
      };

      if (editingId) {
        await announcementService.updateAnnouncement(editingId, payload);
        Alert.alert("Succès", "Annonce mise à jour avec succès.");
      } else {
        await announcementService.createAnnouncement(payload);
        Alert.alert("Succès", "Annonce créée avec succès.");
      }

      resetForm();
      await loadAnnouncements();
    } catch (error) {
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
    const id = item.id ?? item.Id;

    Alert.alert(
      "Supprimer l'annonce",
      "Êtes-vous sûr de vouloir supprimer cette annonce ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => deleteAnnouncement(id),
        },
      ],
    );
  };

  const deleteAnnouncement = async (id) => {
    try {
      setDeletingId(id);
      await announcementService.deleteAnnouncement(id);

      setAnnouncements((prev) =>
        prev.filter((item) => (item.id ?? item.Id) !== id),
      );
    } catch {
      Alert.alert("Erreur", "Impossible de supprimer l'annonce.");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatus = (publishAt, expiresAt) => {
    const now = new Date();
    const publishDate = publishAt ? new Date(publishAt) : null;
    const expiryDate = expiresAt ? new Date(expiresAt) : null;

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
        label: "Planifié",
        containerStyle: styles.badgeScheduled,
        textStyle: styles.badgeScheduledText,
        icon: "time-outline",
      },
      expired: {
        label: "Expiré",
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
    const status = getStatus(publishAt, expiresAt);

    return (
      <View style={[styles.card, isExpired && styles.cardExpired]}>
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
                ? `Publié le ${formatDisplayDate(publishAt)}`
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
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Annonces</Text>

        <View style={styles.topBarBadge}>
          <Text style={styles.topBarBadgeText}>Admin</Text>
        </View>
      </View>

      <ScrollView
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
          style={styles.fab}
          onPress={openCreateForm}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.fabText}>Nouvelle annonce</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statDot, { backgroundColor: "#16A34A" }]} />
            <Text style={styles.statValue}>{liveItems.length}</Text>
            <Text style={styles.statLabel}>En ligne</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statDot, { backgroundColor: "#1D4ED8" }]} />
            <Text style={styles.statValue}>{scheduledItems.length}</Text>
            <Text style={styles.statLabel}>Planifié</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statDot, { backgroundColor: "#6B7280" }]} />
            <Text style={styles.statValue}>{expiredItems.length}</Text>
            <Text style={styles.statLabel}>Expiré</Text>
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
              Créez votre première annonce pour informer l'équipe.
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
        visible={showForm}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={resetForm}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <Text style={styles.sheetTitle}>
                {editingId ? "Modifier l'annonce" : "Nouvelle annonce"}
              </Text>

              <Text style={styles.sheetSubtitle}>
                Visible immédiatement ou selon un calendrier
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={resetForm}
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
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.fieldLabel}>Titre</Text>
            <TextInput
              value={form.title}
              onChangeText={(t) => handleChange("title", t)}
              placeholder="ex. Fermeture bureau vendredi"
              placeholderTextColor={colors.textSecondary}
              style={styles.fieldInput}
            />

            <Text style={styles.fieldLabel}>Contenu</Text>
            <TextInput
              value={form.content}
              onChangeText={(t) => handleChange("content", t)}
              placeholder="Rédigez votre annonce ici…"
              placeholderTextColor={colors.textSecondary}
              style={[styles.fieldInput, styles.fieldTextarea]}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setSchedulePublish((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={styles.toggleText}>
                <Text style={styles.toggleTitle}>Planifier la publication</Text>
                <Text style={styles.toggleSubtitle}>Rendre visible plus tard</Text>
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
                      Publication le {formatPrettyDate(form.publishDate)} à{" "}
                      {formatPrettyTime(form.publishTime)}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            <TouchableOpacity
              style={[styles.toggleRow, { marginTop: spacing.sm }]}
              onPress={() => setAutoExpire((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={styles.toggleText}>
                <Text style={styles.toggleTitle}>Suppression automatique</Text>
                <Text style={styles.toggleSubtitle}>Masquer après une date</Text>
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
                      Expiration le {formatPrettyDate(form.expiryDate)} à{" "}
                      {formatPrettyTime(form.expiryTime)}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.btnPrimary, saving && styles.btnDisabled]}
                onPress={saveAnnouncement}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>
                    {editingId ? "Mettre à jour" : "Publier l'annonce"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={resetForm}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

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
  if (!dateValue || !timeValue) return null;
  const parsed = new Date(`${dateValue}T${timeValue}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoFromParts(dateValue, timeValue) {
  const parsed = combineDateTime(dateValue, timeValue);
  return parsed ? parsed.toISOString() : null;
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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatPrettyDate(dateValue) {
  if (!dateValue) return "—";

  const d = new Date(`${dateValue}T12:00:00`);

  if (Number.isNaN(d.getTime())) {
    const [year, month, day] = dateValue.split("-");
    return year && month && day ? `${day}/${month}/${year}` : "—";
  }

  return d.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPrettyTime(timeValue) {
  if (!timeValue) return "—";

  const [hours, minutes] = timeValue.split(":");

  if (!hours || !minutes) return "—";

  const d = new Date();
  d.setHours(Number(hours), Number(minutes), 0, 0);

  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDatePart(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTimePart(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
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

    sheetContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },

    sheetHandle: {
      width: 42,
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 999,
      alignSelf: "center",
      marginTop: 12,
    },

    sheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    sheetHeaderText: {
      flex: 1,
    },

    sheetTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: colors.textPrimary ?? colors.text,
    },

    sheetSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 3,
    },

    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    sheetScroll: {
      flex: 1,
    },

    sheetScrollContent: {
      padding: 20,
      paddingBottom: 50,
    },

    fieldLabel: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.textPrimary ?? colors.text,
      marginBottom: 8,
      marginTop: 16,
    },

    fieldInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 14,
      color: colors.textPrimary ?? colors.text,
    },

    fieldTextarea: {
      minHeight: 110,
      paddingTop: 13,
    },

    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 14,
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
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 12,
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
      minHeight: 46,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
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
      gap: 10,
      marginTop: spacing.xl,
    },

    btnPrimary: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
    },

    btnPrimaryText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "900",
    },

    btnSecondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: "center",
    },

    btnSecondaryText: {
      color: colors.textPrimary ?? colors.text,
      fontSize: 15,
      fontWeight: "800",
    },

    btnDisabled: {
      opacity: 0.55,
    },
  });

export default ManageAnnouncementsScreen;