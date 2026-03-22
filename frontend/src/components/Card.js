import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function Card({ children, onPress, style, padding = true }) {
  const { colors, spacing, borderRadius, shadows } = useTheme();

  const Wrapper = onPress ? TouchableOpacity : View;

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    padding: {
      padding: spacing.lg,
    },
  });

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.card, padding && styles.padding, style]}
    >
      {children}
    </Wrapper>
  );
}

export default Card;