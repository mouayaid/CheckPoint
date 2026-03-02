import React, { useState } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { authService } from '../services/api';
import { ScreenContainer, Button, Input, Card } from '../components';
import { colors, spacing, typography } from '../theme/theme';

const DEFAULT_DEPARTMENT_ID = 1; // IT department from seed data

const RegisterScreen = () => {
  const navigation = useNavigation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const next = {};
    if (!fullName.trim()) next.fullName = 'Please enter your full name';
    if (!email.trim()) next.email = 'Please enter your email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Please enter a valid email';
    if (!password) next.password = 'Please enter a password';
    else if (password.length < 6) next.password = 'Password must be at least 6 characters';
    if (!confirmPassword) next.confirmPassword = 'Please confirm your password';
    else if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    try {
      const payload = {
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        // Backend ignores Role and LeaveBalance from client.
        departmentId: DEFAULT_DEPARTMENT_ID,
      };

      const response = await authService.register(payload);

      if (response.success) {
        Alert.alert(
          'Account created',
          'Your account is created and waiting for admin approval. You can login after approval.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Registration failed', response.message || 'Unable to create account');
      }
    } catch (error) {
      console.error('Register error:', error);
      Alert.alert(
        'Error',
        error.message || 'Registration failed. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll keyboardAvoid>
      <View style={styles.outer}>
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Register to request access</Text>
        </View>

        <Card style={styles.card}>
          <Input
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="John Doe"
            autoCapitalize="words"
            error={errors.fullName}
            editable={!loading}
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            editable={!loading}
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            error={errors.password}
            editable={!loading}
          />
          <Input
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            error={errors.confirmPassword}
            editable={!loading}
            onSubmitEditing={handleRegister}
          />
          <Button
            title="Register"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
          />
          <Button
            title="Back to login"
            variant="ghost"
            onPress={() => navigation.goBack()}
            disabled={loading}
            style={styles.secondaryButton}
          />
        </Card>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  card: {
    padding: spacing.xl,
  },
  button: {
    marginTop: spacing.sm,
  },
  secondaryButton: {
    marginTop: spacing.xs,
  },
});

export default RegisterScreen;

