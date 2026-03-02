import React from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/theme';

/**
 * Wrapper for screen content: safe area, background, optional scroll.
 */
export function ScreenContainer({
  children,
  scroll = false,
  keyboardAvoid = false,
  style,
  contentContainerStyle,
}) {
  const insets = useSafeAreaInsets();
  const paddingStyle = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: spacing.lg + insets.left,
    paddingRight: spacing.lg + insets.right,
  };

  const content = (
    <View style={[styles.container, paddingStyle, style]}>
      {children}
    </View>
  );

  if (keyboardAvoid) {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, styles.container]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, paddingStyle, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    );
  }

  if (scroll) {
    return (
      <ScrollView
        style={[styles.flex, styles.container]}
        contentContainerStyle={[styles.scrollContent, paddingStyle, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default ScreenContainer;
