import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../context/ThemeContext";

const TYPE_META = {
  success: {
    icon: "checkmark-circle",
    colorKey: "success",
    lightKey: "successLight",
  },
  error: {
    icon: "close-circle",
    colorKey: "error",
    lightKey: "errorLight",
  },
  warning: {
    icon: "warning",
    colorKey: "warning",
    lightKey: "warningLight",
  },
  info: {
    icon: "information-circle",
    colorKey: "info",
    lightKey: "infoLight",
  },
  processing: {
    colorKey: "primary",
    lightKey: "primaryLight",
  },
};

export default function FeedbackModal({
  visible,
  type = "info",
  title,
  message,
  confirmText = "OK",
  cancelText,
  onConfirm,
  onCancel,
}) {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const animation = useRef(new Animated.Value(0)).current;

  const meta = TYPE_META[type] || TYPE_META.info;
  const isProcessing = type === "processing";
  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(animation, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(animation, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [animation, visible]);

  if (!mounted) return null;

  const accentColor = colors[meta.colorKey] || colors.info;
  const accentBackground = colors[meta.lightKey] || colors.infoLight;
  const scale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  const handleConfirm = () => {
    if (isProcessing) return;
    onConfirm?.();
  };

  const handleCancel = () => {
    if (isProcessing) return;
    if (onCancel) {
      onCancel();
      return;
    }

    onConfirm?.();
  };

  return (
    <Modal
      testID="feedback.modal"
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={isProcessing ? () => {} : handleCancel}
    >
      <Animated.View style={[styles.overlay, { opacity: animation }]}>
        <Pressable style={StyleSheet.absoluteFill} />
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale }],
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: accentBackground }]}> 
            {isProcessing
              ? <ActivityIndicator testID="feedback.processingIndicator" size="large" color={accentColor} />
              : <Ionicons name={meta.icon} size={42} color={accentColor} />}
          </View>

          {!!title && <Text testID="feedback.title" style={styles.title}>{title}</Text>}
          {!!message && <Text testID="feedback.message" style={styles.message}>{message}</Text>}

          {!isProcessing && <View style={styles.actionRow}>
            {!!cancelText && (
              <TouchableOpacity
                testID="feedback.cancelButton"
                activeOpacity={0.85}
                onPress={handleCancel}
                style={[styles.button, styles.secondaryButton]}
              >
                <Text style={styles.secondaryButtonText}>{cancelText}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              testID="feedback.confirmButton"
              activeOpacity={0.9}
              onPress={handleConfirm}
              style={[
                styles.button,
                styles.primaryButton,
                { backgroundColor: accentColor },
              ]}
            >
              <Text style={styles.primaryButtonText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      backgroundColor: "rgba(0, 0, 0, 0.58)",
    },
    card: {
      width: "100%",
      maxWidth: 380,
      borderRadius: borderRadius.xl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      backgroundColor: colors.surfaceElevated || colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      ...shadows.lg,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: typography.xl,
      fontFamily: typography.fontFamily?.bold,
      fontWeight: typography.bold,
      color: colors.text,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    message: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 21,
      marginBottom: spacing.xl,
    },
    actionRow: {
      flexDirection: "row",
      width: "100%",
      gap: spacing.sm,
    },
    button: {
      flex: 1,
      minHeight: 46,
      borderRadius: borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    primaryButton: {
      ...shadows.sm,
    },
    secondaryButton: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryButtonText: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      fontWeight: typography.semibold,
      color: colors.textOnPrimary,
    },
    secondaryButtonText: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      fontWeight: typography.semibold,
      color: colors.text,
    },
  });
