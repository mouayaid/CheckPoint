import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useTheme } from "../context/ThemeContext";

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary", // 'primary' | 'secondary' | 'ghost' | 'danger'
  style,
  textStyle,
}) {
  const { colors, spacing, borderRadius, typography } = useTheme();

  const getColors = () => {
    switch (variant) {
      case "secondary":
        return {
          bg: colors.surface,
          border: colors.border,
          text: colors.text,
          spinner: colors.text,
        };
      case "ghost":
        return {
          bg: "transparent",
          border: "transparent",
          text: colors.primary,
          spinner: colors.primary,
        };
      case "danger":
        return {
          bg: colors.error,
          border: "transparent",
          text: colors.textOnPrimary,
          spinner: colors.textOnPrimary,
        };
      case "primary":
      default:
        return {
          bg: colors.primary,
          border: "transparent",
          text: colors.textOnPrimary,
          spinner: colors.textOnPrimary,
        };
    }
  };

  const palette = getColors();

  const styles = StyleSheet.create({
    button: {
      height: 54,
      borderRadius: borderRadius.lg,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.sm,
      borderWidth: 1,
    },

    text: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
    },

    disabled: {
      opacity: 0.6,
    },
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.spinner} />
      ) : (
        <Text style={[styles.text, { color: palette.text }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default Button;