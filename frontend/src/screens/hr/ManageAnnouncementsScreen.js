import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { Card, Button } from "../../components";
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

  const loadAnnouncements = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await announcementService.getManageAnnouncements();
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setAnnouncements(data);
    } catch (error) {
      console.log("Manage announcements error", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      Alert.alert("Error", "Failed to load announcements.");
      setAnnouncements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

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
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!form.title.trim()) {
      Alert.alert("Validation", "Title is required.");
      return false;
    }

    if (!form.content.trim()) {
      Alert.alert("Validation", "Content is required.");
      return false;
    }

    const publishAtValue = schedulePublish
      ? combineDateTime(form.publishDate, form.publishTime)
      : null;

    const expiresAtValue = autoExpire
      ? combineDateTime(form.expiryDate, form.expiryTime)
      : null;

    if (schedulePublish && (!form.publishDate || !form.publishTime)) {
      Alert.alert(
        "Validation",
        "Please enter both publish date and publish time.",
      );
      return false;
    }

    if (autoExpire && (!form.expiryDate || !form.expiryTime)) {
      Alert.alert(
        "Validation",
        "Please enter both expiry date and expiry time.",
      );
      return false;
    }

    if (schedulePublish && !publishAtValue) {
      Alert.alert("Validation", "Publish date/time is invalid.");
      return false;
    }

    if (autoExpire && !expiresAtValue) {
      Alert.alert("Validation", "Expiry date/time is invalid.");
      return false;
    }

    if (publishAtValue && expiresAtValue && expiresAtValue <= publishAtValue) {
      Alert.alert("Validation", "Expiry time must be after publish time.");
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
        Alert.alert("Success", "Announcement updated successfully.");
      } else {
        await announcementService.createAnnouncement(payload);
        Alert.alert("Success", "Announcement created successfully.");
      }

      resetForm();
      await loadAnnouncements();
    } catch (error) {
      console.log("Save announcement error", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });

      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to save announcement.",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item) => {
    const id = item.id ?? item.Id;

    Alert.alert(
      "Delete announcement",
      "Are you sure you want to delete this announcement?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
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
    } catch (error) {
      console.log("Delete announcement error", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      Alert.alert("Error", "Failed to delete announcement.");
    } finally {
      setDeletingId(null);
    }
  };

  const renderStatusBadge = (publishAt, expiresAt) => {
    const now = new Date();
    const publishDate = publishAt ? new Date(publishAt) : null;
    const expiryDate = expiresAt ? new Date(expiresAt) : null;

    let label = "Published";
    let badgeStyle = styles.badgePublished;
    let textStyle = styles.badgePublishedText;
    let icon = "checkmark-circle-outline";

    if (publishDate && publishDate > now) {
      label = "Scheduled";
      badgeStyle = styles.badgeScheduled;
      textStyle = styles.badgeScheduledText;
      icon = "time-outline";
    } else if (expiryDate && expiryDate <= now) {
      label = "Expired";
      badgeStyle = styles.badgeExpired;
      textStyle = styles.badgeExpiredText;
      icon = "close-circle-outline";
    }

    return (
      <View style={[styles.statusBadge, badgeStyle]}>
        <Ionicons name={icon} size={14} style={textStyle} />
        <Text style={textStyle}>{label}</Text>
      </View>
    );
  };

  const renderAnnouncement = ({ item }) => {
    const id = item.id ?? item.Id;
    const title = item.title ?? item.Title ?? "Untitled";
    const content = item.content ?? item.Content ?? "";
    const publishAt = item.publishAt ?? item.PublishAt;
    const expiresAt = item.expiresAt ?? item.ExpiresAt;
    const createdAt = item.createdAt ?? item.CreatedAt;
    const updatedAt = item.updatedAt ?? item.UpdatedAt;

    return (
      <Card style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={styles.itemHeaderLeft}>
            <Text style={styles.itemTitle}>{title}</Text>
            {renderStatusBadge(publishAt, expiresAt)}
          </View>
        </View>

        <Text style={styles.itemContent} numberOfLines={4}>
          {content}
        </Text>

        <View style={styles.metaGrid}>
          <View style={styles.metaChip}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.metaChipText}>
              {publishAt
                ? `Publish: ${formatDisplayDate(publishAt)}`
                : "Publish: immediately"}
            </Text>
          </View>

          <View style={styles.metaChip}>
            <Ionicons
              name="hourglass-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.metaChipText}>
              {expiresAt
                ? `Expiry: ${formatDisplayDate(expiresAt)}`
                : "Expiry: none"}
            </Text>
          </View>

          <View style={styles.metaChip}>
            <Ionicons
              name="add-circle-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.metaChipText}>
              {createdAt
                ? `Created: ${formatDisplayDate(createdAt)}`
                : "Created: —"}
            </Text>
          </View>

          {updatedAt ? (
            <View style={styles.metaChip}>
              <Ionicons
                name="create-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.metaChipText}>
                Updated: {formatDisplayDate(updatedAt)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.ghostAction}
            onPress={() => openEditForm(item)}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={styles.ghostActionText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerAction}
            onPress={() => confirmDelete(item)}
            disabled={deletingId === id}
            activeOpacity={0.85}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.dangerActionText}>
              {deletingId === id ? "Deleting..." : "Delete"}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.stateText}>Loading announcements...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={announcements}
      keyExtractor={(item) => String(item.id ?? item.Id)}
      renderItem={renderAnnouncement}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadAnnouncements(true)}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark || colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroIconWrap}>
                <Ionicons
                  name="megaphone-outline"
                  size={22}
                  color={colors.textOnPrimary || "#fff"}
                />
              </View>

              <View style={styles.heroTextWrap}>
                <Text style={styles.heroTitle}>Manage announcements</Text>
                <Text style={styles.heroSubtitle}>
                  Create, schedule, update, and control what employees see.
                </Text>
              </View>
            </View>

            {!showForm ? (
              <Button
                title="Create announcement"
                onPress={openCreateForm}
                style={styles.heroButton}
              />
            ) : null}
          </LinearGradient>

          {showForm && (
            <Card style={styles.formCard}>
              <View style={styles.formHeader}>
                <View style={styles.formHeaderTextWrap}>
                  <Text style={styles.formTitle}>
                    {editingId ? "Edit announcement" : "Create announcement"}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    Fill in the details below and choose whether to schedule or
                    expire it.
                  </Text>
                </View>

                <TouchableOpacity onPress={resetForm} style={styles.closeButton}>
                  <Ionicons name="close-outline" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                value={form.title}
                onChangeText={(text) => handleChange("title", text)}
                placeholder="Announcement title"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Content</Text>
              <TextInput
                value={form.content}
                onChangeText={(text) => handleChange("content", text)}
                placeholder="Write the announcement content"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.textArea]}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.optionCard}>
                <View style={styles.switchRow}>
                  <View style={styles.switchTextWrap}>
                    <Text style={styles.switchTitle}>Schedule publish</Text>
                    <Text style={styles.switchSubtitle}>
                      Make it visible later instead of immediately
                    </Text>
                  </View>
                  <Switch
                    value={schedulePublish}
                    onValueChange={setSchedulePublish}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>

                {schedulePublish && (
                  <>
                    <Text style={styles.inputLabel}>Publish date</Text>
                    <TextInput
                      value={form.publishDate}
                      onChangeText={(text) => handleChange("publishDate", text)}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.input}
                    />

                    <Text style={styles.inputLabel}>Publish time</Text>
                    <TextInput
                      value={form.publishTime}
                      onChangeText={(text) => handleChange("publishTime", text)}
                      placeholder="HH:mm"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.input}
                    />

                    <View style={styles.previewBox}>
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.previewText}>
                        Will publish on {formatPrettyDate(form.publishDate)} at{" "}
                        {formatPrettyTime(form.publishTime)}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.optionCard}>
                <View style={styles.switchRow}>
                  <View style={styles.switchTextWrap}>
                    <Text style={styles.switchTitle}>Auto remove</Text>
                    <Text style={styles.switchSubtitle}>
                      Expire this announcement automatically
                    </Text>
                  </View>
                  <Switch
                    value={autoExpire}
                    onValueChange={setAutoExpire}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>

                {autoExpire && (
                  <>
                    <Text style={styles.inputLabel}>Expiry date</Text>
                    <TextInput
                      value={form.expiryDate}
                      onChangeText={(text) => handleChange("expiryDate", text)}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.input}
                    />

                    <Text style={styles.inputLabel}>Expiry time</Text>
                    <TextInput
                      value={form.expiryTime}
                      onChangeText={(text) => handleChange("expiryTime", text)}
                      placeholder="HH:mm"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.input}
                    />

                    <View style={styles.previewBox}>
                      <Ionicons
                        name="hourglass-outline"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.previewText}>
                        Will expire on {formatPrettyDate(form.expiryDate)} at{" "}
                        {formatPrettyTime(form.expiryTime)}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.formActions}>
                <Button
                  title={
                    saving
                      ? "Saving..."
                      : editingId
                        ? "Update announcement"
                        : "Create announcement"
                  }
                  onPress={saveAnnouncement}
                  style={styles.formButton}
                  disabled={saving}
                />

                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={resetForm}
                  style={styles.formButton}
                  disabled={saving}
                />
              </View>
            </Card>
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Published and scheduled</Text>
            <View style={styles.counterPill}>
              <Text style={styles.counterText}>{announcements.length}</Text>
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="megaphone-outline"
              size={34}
              color={colors.textSecondary}
            />
          </View>
          <Text style={styles.emptyTitle}>No announcements yet</Text>
          <Text style={styles.stateText}>
            Create your first announcement to share updates with the team.
          </Text>
          {!showForm ? (
            <Button
              title="Create first announcement"
              onPress={openCreateForm}
              style={styles.emptyButton}
            />
          ) : null}
        </View>
      }
    />
  );
};

function combineDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;

  const combined = `${dateValue}T${timeValue}`;
  const parsed = new Date(combined);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoFromParts(dateValue, timeValue) {
  const parsed = combineDateTime(dateValue, timeValue);
  return parsed ? parsed.toISOString() : null;
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
  if (!dateValue) return "Select date";

  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) {
    const [year, month, day] = dateValue.split("-");
    if (!year || !month || !day) return "Select date";
    return `${day}/${month}/${year}`;
  }

  return d.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPrettyTime(timeValue) {
  if (!timeValue) return "Select time";

  const [hours, minutes] = timeValue.split(":");
  if (!hours || !minutes) return "Select time";

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

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimePart(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    listContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      backgroundColor: colors.background,
      flexGrow: 1,
    },

    hero: {
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },

    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      marginBottom: spacing.md,
    },

    heroIconWrap: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.full,
      backgroundColor: "rgba(255,255,255,0.14)",
      alignItems: "center",
      justifyContent: "center",
    },

    heroTextWrap: {
      flex: 1,
    },

    heroTitle: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.textOnPrimary || "#fff",
      marginBottom: 4,
    },

    heroSubtitle: {
      fontSize: typography.sm,
      color: colors.textOnPrimary || "#fff",
      opacity: 0.9,
      lineHeight: 20,
    },

    heroButton: {
      marginTop: spacing.sm,
    },

    formCard: {
      padding: spacing.lg,
      marginBottom: spacing.lg,
      backgroundColor: colors.surface,
    },

    formHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.md,
      marginBottom: spacing.md,
    },

    formHeaderTextWrap: {
      flex: 1,
    },

    closeButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },

    formTitle: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: 4,
    },

    formSubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    inputLabel: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.text,
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },

    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.background,
      color: colors.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: typography.sm,
    },

    textArea: {
      minHeight: 120,
      paddingTop: spacing.md,
    },

    optionCard: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },

    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },

    switchTextWrap: {
      flex: 1,
    },

    switchTitle: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.text,
    },

    switchSubtitle: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },

    previewBox: {
      marginTop: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
    },

    previewText: {
      flex: 1,
      fontSize: typography.xs,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    formActions: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.lg,
    },

    formButton: {
      flex: 1,
    },

    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },

    sectionTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
    },

    counterPill: {
      minWidth: 28,
      height: 28,
      paddingHorizontal: 8,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },

    counterText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.text,
    },

    itemCard: {
      padding: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
    },

    itemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: spacing.sm,
    },

    itemHeaderLeft: {
      flex: 1,
      gap: spacing.xs,
    },

    itemTitle: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
      lineHeight: 22,
    },

    itemContent: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 21,
      marginBottom: spacing.md,
    },

    statusBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: borderRadius.full,
    },

    badgePublished: {
      backgroundColor: colors.successLight,
    },

    badgePublishedText: {
      color: colors.success,
      fontSize: typography.xs,
      fontWeight: typography.semibold,
    },

    badgeScheduled: {
      backgroundColor: colors.surfaceMuted,
    },

    badgeScheduledText: {
      color: colors.primary,
      fontSize: typography.xs,
      fontWeight: typography.semibold,
    },

    badgeExpired: {
      backgroundColor: colors.errorLight || "#FDECEC",
    },

    badgeExpiredText: {
      color: colors.error,
      fontSize: typography.xs,
      fontWeight: typography.semibold,
    },

    metaGrid: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    metaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },

    metaChipText: {
      flex: 1,
      fontSize: typography.xs,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    actionsRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.xs,
    },

    ghostAction: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },

    ghostActionText: {
      color: colors.primary,
      fontSize: typography.sm,
      fontWeight: typography.semibold,
    },

    dangerAction: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.md,
      backgroundColor: colors.error,
    },

    dangerActionText: {
      color: "#fff",
      fontSize: typography.sm,
      fontWeight: typography.semibold,
    },

    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.background,
    },

    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
    },

    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },

    emptyTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: spacing.xs,
    },

    stateText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginTop: spacing.xs,
    },

    emptyButton: {
      marginTop: spacing.lg,
      minWidth: 220,
    },
  });

export default ManageAnnouncementsScreen;