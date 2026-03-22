import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export const Input = React.forwardRef(({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  editable = true,
  error,
  ...rest
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const { colors, spacing, typography, borderRadius } = useTheme();

  const isPassword = secureTextEntry === true;

  const styles = StyleSheet.create({
    wrap: {
      marginBottom: spacing.md,
    },

    label: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },

    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingHorizontal: 16,
    },

    inputContainerFocused: {
      borderColor: colors.primary,
      borderWidth: 1.5,
      backgroundColor: colors.inputBackground,
    },

    inputContainerError: {
      borderColor: colors.error,
    },

    inputContainerDisabled: {
      backgroundColor: colors.borderLight,
      opacity: 0.8,
    },

    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: typography.base,
      color: colors.text,
    },

    eyeButton: {
      marginLeft: 10,
    },

    errorText: {
      fontSize: typography.xs,
      color: colors.error,
      marginTop: 4,
    },
  });

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputContainer,
          focused && styles.inputContainerFocused,
          error && styles.inputContainerError,
          !editable && styles.inputContainerDisabled,
        ]}
      >
        <TextInput
          ref={ref}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={showPassword ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

export default Input;