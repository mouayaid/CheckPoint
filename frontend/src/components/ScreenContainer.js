import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export function ScreenContainer({
  children,
  scroll = false,
  keyboardAvoid = false,
  style,
  contentContainerStyle,
  backgroundColor,
}) {
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();

  const resolvedBackgroundColor = backgroundColor ?? colors.background;

  const paddingStyle = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: spacing.lg + insets.left,
    paddingRight: spacing.lg + insets.right,
  };

  const content = (
    <View
      style={[
        styles.container,
        { backgroundColor: resolvedBackgroundColor },
        paddingStyle,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (keyboardAvoid) {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: resolvedBackgroundColor }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            style={[styles.flex, { backgroundColor: resolvedBackgroundColor }]}
            contentContainerStyle={[
              styles.scrollContent,
              { backgroundColor: resolvedBackgroundColor },
              paddingStyle,
              contentContainerStyle,
            ]}
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
        style={[styles.flex, { backgroundColor: resolvedBackgroundColor }]}
        contentContainerStyle={[
          styles.scrollContent,
          { backgroundColor: resolvedBackgroundColor },
          paddingStyle,
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default ScreenContainer;