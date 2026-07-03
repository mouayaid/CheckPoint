import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeContext";

export default function ConfirmActionModal({
  visible,
  title,
  message,
  cancelLabel = "Annuler",
  confirmLabel = "Confirmer",
  destructive = false,
  loading = false,
  onCancel,
  onConfirm,
}) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows),
    [colors, spacing, borderRadius, typography, shadows],
  );

  const confirmColor = destructive ? colors.error : colors.textOnPrimary;
  const iconColor = destructive ? colors.error : colors.primary;
  const confirmBackground = destructive ? colors.errorLight : colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={destructive ? "warning-outline" : "help-circle-outline"}
              size={22}
              color={iconColor}
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                {
                  backgroundColor: confirmBackground,
                  borderColor: confirmColor,
                },
                loading && styles.disabledButton,
              ]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={confirmColor} />
              ) : (
                <Text style={[styles.confirmText, { color: confirmColor }]}>
                  {confirmLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors, spacing, borderRadius, typography, shadows) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
      backgroundColor: colors.overlay,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.lg,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
      backgroundColor: colors.surfaceMuted,
    },
    title: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    message: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    cancelButton: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: borderRadius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    confirmButton: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: borderRadius.md,
      borderWidth: 1,
    },
    disabledButton: {
      opacity: 0.65,
    },
    cancelText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: colors.textSecondary,
    },
    confirmText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
    },
  });
