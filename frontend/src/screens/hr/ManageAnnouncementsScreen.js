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
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Card, Button } from "../../components";
import { announcementService } from "../../services/api/announcementService";

const emptyForm = {
  title: "",
  content: "",
  publishAt: "",
  expiresAt: "",
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
      publishAt: publishAt ? formatForInput(publishAt) : "",
      expiresAt: expiresAt ? formatForInput(expiresAt) : "",
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

    const publishAtValue = schedulePublish ? parseInputDate(form.publishAt) : null;
    const expiresAtValue = autoExpire ? parseInputDate(form.expiresAt) : null;

    if (schedulePublish && !publishAtValue) {
      Alert.alert(
        "Validation",
        "Publish time is invalid. Use format YYYY-MM-DD HH:mm",
      );
      return false;
    }

    if (autoExpire && !expiresAtValue) {
      Alert.alert(
        "Validation",
        "Expiry time is invalid. Use format YYYY-MM-DD HH:mm",
      );
      return false;
    }

    if (publishAtValue && expiresAtValue && expiresAtValue <= publishAtValue) {
      Alert.alert(
        "Validation",
        "Expiry time must be after publish time.",
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
          schedulePublish && form.publishAt.trim()
            ? toIsoString(form.publishAt.trim())
            : null,
        expiresAt:
          autoExpire && form.expiresAt.trim()
            ? toIsoString(form.expiresAt.trim())
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
        <View style={styles.itemTopRow}>
          <View style={styles.itemTitleWrap}>
            <Text style={styles.itemTitle}>{title}</Text>
            <Text style={styles.itemContent} numberOfLines={3}>
              {content}
            </Text>
          </View>
        </View>

        <View style={styles.metaBlock}>
          <Text style={styles.metaText}>
            Created: {createdAt ? formatDisplayDate(createdAt) : "—"}
          </Text>

          {updatedAt ? (
            <Text style={styles.metaText}>
              Updated: {formatDisplayDate(updatedAt)}
            </Text>
          ) : null}

          {publishAt ? (
            <Text style={styles.metaText}>
              Publish at: {formatDisplayDate(publishAt)}
            </Text>
          ) : (
            <Text style={styles.metaText}>Publish: immediately</Text>
          )}

          {expiresAt ? (
            <Text style={styles.metaText}>
              Expires at: {formatDisplayDate(expiresAt)}
            </Text>
          ) : (
            <Text style={styles.metaText}>Expiry: none</Text>
          )}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => openEditForm(item)}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => confirmDelete(item)}
            disabled={deletingId === id}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>
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
          <Card style={styles.headerCard}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons
                  name="megaphone-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>

              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>Manage announcements</Text>
                <Text style={styles.headerSubtitle}>
                  Create, edit, schedule, and expire company announcements.
                </Text>
              </View>
            </View>

            {!showForm ? (
              <Button
                title="Create announcement"
                onPress={openCreateForm}
                style={styles.topButton}
              />
            ) : null}
          </Card>

          {showForm && (
            <Card style={styles.formCard}>
              <Text style={styles.formTitle}>
                {editingId ? "Edit announcement" : "Create announcement"}
              </Text>

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

              <View style={styles.switchRow}>
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchTitle}>Schedule publish</Text>
                  <Text style={styles.switchSubtitle}>
                    Set when this announcement becomes visible
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
                  <Text style={styles.inputLabel}>Publish time</Text>
                  <TextInput
                    value={form.publishAt}
                    onChangeText={(text) => handleChange("publishAt", text)}
                    placeholder="YYYY-MM-DD HH:mm"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                  />
                </>
              )}

              <View style={styles.switchRow}>
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchTitle}>Auto remove</Text>
                  <Text style={styles.switchSubtitle}>
                    Set when this announcement should expire
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
                  <Text style={styles.inputLabel}>Expiry time</Text>
                  <TextInput
                    value={form.expiresAt}
                    onChangeText={(text) => handleChange("expiresAt", text)}
                    placeholder="YYYY-MM-DD HH:mm"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                  />
                </>
              )}

              <View style={styles.formActions}>
                <Button
                  title={saving ? "Saving..." : editingId ? "Update" : "Create"}
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

          <Text style={styles.sectionTitle}>Published and scheduled</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.centerState}>
          <Ionicons
            name="document-text-outline"
            size={48}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyTitle}>No announcements yet</Text>
          <Text style={styles.stateText}>
            Create your first announcement to share updates with the team.
          </Text>
        </View>
      }
    />
  );
};

function parseInputDate(value) {
  if (!value) return null;

  const normalized = value.trim().replace(" ", "T");
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoString(value) {
  const parsed = parseInputDate(value);
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

function formatForInput(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    listContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      backgroundColor: colors.background,
      flexGrow: 1,
    },

    headerCard: {
      padding: spacing.lg,
      marginBottom: spacing.lg,
      backgroundColor: colors.surface,
    },

    headerTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      marginBottom: spacing.md,
    },

    headerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },

    headerTextWrap: {
      flex: 1,
    },

    headerTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: 4,
    },

    headerSubtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    topButton: {
      marginTop: spacing.sm,
    },

    formCard: {
      padding: spacing.lg,
      marginBottom: spacing.lg,
      backgroundColor: colors.surface,
    },

    formTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: spacing.md,
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
      borderRadius: borderRadius.md,
      backgroundColor: colors.background,
      color: colors.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.sm,
    },

    textArea: {
      minHeight: 110,
      paddingTop: spacing.md,
    },

    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
      marginTop: spacing.md,
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
    },

    formActions: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.lg,
    },

    formButton: {
      flex: 1,
    },

    sectionTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: spacing.md,
    },

    itemCard: {
      padding: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
    },

    itemTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },

    itemTitleWrap: {
      flex: 1,
    },

    itemTitle: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: 6,
    },

    itemContent: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    metaBlock: {
      marginTop: spacing.sm,
      marginBottom: spacing.md,
      gap: 4,
    },

    metaText: {
      fontSize: typography.xs,
      color: colors.textSecondary,
    },

    actionsRow: {
      flexDirection: "row",
      gap: spacing.md,
    },

    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },

    editButton: {
      backgroundColor: colors.primary,
    },

    deleteButton: {
      backgroundColor: colors.error,
    },

    actionButtonText: {
      color: "#fff",
      fontSize: typography.sm,
      fontWeight: typography.semibold,
    },

    centerState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
    },

    stateText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.sm,
      lineHeight: 20,
    },

    emptyTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginTop: spacing.md,
    },
  });

export default ManageAnnouncementsScreen;