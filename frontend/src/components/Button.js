import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../theme/theme';

const variants = {
  primary: {
    bg: colors.primary,
    text: colors.textOnPrimary,
  },
  secondary: {
    bg: colors.borderLight,
    text: colors.textPrimary,
  },
  outline: {
    bg: 'transparent',
    border: colors.primary,
    text: colors.primary,
  },
  ghost: {
    bg: 'transparent',
    text: colors.primary,
  },
  danger: {
    bg: colors.error,
    text: colors.textOnPrimary,
  },
};

const sizes = {
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  lg: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl },
};

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'lg',
  leftIcon,
  style,
  textStyle,
}) {
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.lg;
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          ...(isOutline && { borderWidth: 2, borderColor: v.border }),
          ...s,
          opacity: disabled && !loading ? 0.6 : 1,
        },
        variant === 'primary' && shadows.sm,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <>
          {leftIcon}
          <Text style={[styles.text, { color: v.text }, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    minHeight: 48,
    gap: spacing.sm,
  },
  text: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
});

export default Button;
