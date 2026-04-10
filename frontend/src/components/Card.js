import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function Card({ children, onPress, style, padding = true }) {
  const { colors, spacing, borderRadius, shadows, darkMode } = useTheme();

  const Wrapper = onPress ? TouchableOpacity : View;

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      // If dark mode, we use border and no shadow. If light mode, use shadow and no border.
      borderWidth: darkMode ? 1 : 0,
      borderColor: darkMode ? colors.border : "transparent",
      ...(darkMode ? {} : shadows.md), 
    },
    padding: {
      padding: spacing.lg,
    },
  });

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={[styles.card, padding && styles.padding, style]}
    >
      {children}
    </Wrapper>
  );
}

export default Card;