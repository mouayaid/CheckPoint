import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { authService } from '../services/api';
import { Button, Input } from '../components';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const LoginScreen = () => {
  const navigation = useNavigation();
  const { signIn } = useAuth();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const passwordRef = useRef(null);

  const validate = () => {
    const next = {};

    if (!email.trim()) {
      next.email = "Veuillez saisir votre e-mail";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Veuillez saisir un e-mail valide";
    }

    if (!password) {
      next.password = "Veuillez saisir votre mot de passe";
    }

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
          Alert.alert("Connexion échouée", "Réponse invalide du serveur");
        }
      } else {
        Alert.alert(
          "Connexion échouée",
          response.message || "E-mail ou mot de passe invalide"
        );
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        "Erreur",
        error.message ||
          "Échec de la connexion. Veuillez vérifier votre connexion et réessayer."
      );
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    gradient: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxxl,
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.xxl,
    },
    logoBox: {
      width: 96,
      height: 96,
      borderRadius: borderRadius.xl + 4,
      backgroundColor: colors.surfaceElevated,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    logo: {
      width: 74,
      height: 74,
    },
    brandText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
      fontWeight: typography.medium,
    },
    subtitle: {
      fontSize: typography.xxl,
      color: colors.text,
      fontWeight: typography.bold,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 28,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl + 4,
      paddingBottom: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    forgotButton: {
      alignSelf: 'flex-end',
      marginTop: 2,
      marginBottom: spacing.sm,
    },
    forgotText: {
      fontSize: typography.sm,
      color: colors.primary,
      fontWeight: typography.semibold,
    },
    signInButton: {
      marginTop: 4,
    },
    footer: {
      marginTop: spacing.xl + 2,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    footerText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },
    footerLink: {
      fontSize: typography.sm,
      color: colors.primary,
      fontWeight: typography.bold,
    },
  });

  return (
    <LinearGradient
      colors={[colors.authBackgroundTop, colors.authBackgroundBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View style={styles.logoBox}>
                <Image
                  source={require('../assets/checkpoint.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.brandText}>by Triweb</Text>
<Text style={styles.subtitle}>Connectez-vous à votre compte</Text>
            </View>

            <View style={styles.card}>
              <Input
label="Email professionnel"
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={errors.email}
                editable={!loading}
              />

              <Input
                ref={passwordRef}
label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                error={errors.password}
                editable={!loading}
              />

              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.forgotButton}
                onPress={() =>
                  Alert.alert(
                    "Bientôt disponible",
                    "La fonctionnalité « mot de passe oublié » n'est pas encore disponible."
                  )
                }
                disabled={loading}
              >
<Text style={styles.forgotText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>

              <Button
title="Se connecter"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={styles.signInButton}
              />

              <View style={styles.footer}>
 <Text style={styles.footerText}>Pas de compte ? </Text>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate('Register')}
                  disabled={loading}
                >
 <Text style={styles.footerLink}>Créez-en un</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default LoginScreen;