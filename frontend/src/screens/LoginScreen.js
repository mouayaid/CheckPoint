import React, { useState } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { authService } from '../services/api';
import { ScreenContainer, Button, Input, Card } from '../components';
import { colors, spacing, typography } from '../theme/theme';

const LoginScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { signIn } = useAuth();

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = 'Please enter your email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Please enter a valid email';
    if (!password) next.password = 'Please enter your password';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    try {
      const response = await authService.login(email.trim(), password);

      if (response.success && response.data) {
        const { token, user } = response.data;
        if (token && user) {
          await signIn(token, user);
        } else {
          Alert.alert('Login Failed', 'Invalid response from server');
        }
      } else {
        Alert.alert('Login Failed', response.message || 'Invalid email or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        'Error',
        error.message || 'Login failed. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll keyboardAvoid>
      <View style={styles.outer}>
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Text style={styles.logo}>Triweb</Text>
          </View>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <Card style={styles.card}>
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
            onSubmitEditing={handleLogin}
          />
          <Button
            title="Sign in"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
          />
          <Button
            title="Create an account"
            variant="ghost"
            onPress={() => navigation.navigate('Register')}
            disabled={loading}
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
  logoWrap: {
    marginBottom: spacing.sm,
  },
  logo: {
    fontSize: typography.display,
    fontWeight: typography.bold,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  card: {
    padding: spacing.xl,
  },
  button: {
    marginTop: spacing.sm,
  },
});

export default LoginScreen;
