import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export function EmptyState({
  iconName = 'folder-open-outline',
  title = 'Nothing here yet',
  subtitle,
  style,
}) {
  const { colors, spacing, typography } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xxl,
    },

    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.surfaceMuted,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },

    title: {
      fontSize: typography.lg,
      fontWeight: typography.semibold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },

    subtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 280,
    },
  });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconWrap}>
        <Ionicons
          name={iconName}
          size={48}
          color={colors.textMuted}
        />
      </View>

      <Text style={styles.title}>{title}</Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export default EmptyState;