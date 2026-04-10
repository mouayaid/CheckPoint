import React, { useRef } from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
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
  
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  const getColors = () => {
    switch (variant) {
      case "secondary":
        return {
          bg: colors.surface,
          border: colors.border,
          text: colors.textPrimary,
          spinner: colors.textPrimary,
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
          text: colors.white, // assuming text on primary is white
          spinner: colors.white,
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
      overflow: "hidden",
    },

    text: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily.semibold,
    },

    disabled: {
      opacity: 0.6,
    },
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
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
    </Animated.View>
  );
}

export default Button;