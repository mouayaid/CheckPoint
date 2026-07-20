import logger from "../utils/logger";
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { authService } from "../services/api";
import { Button, Input } from "../components";
import { useTheme } from "../context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import FeedbackModal from "../components/FeedbackModal";
import { useFeedback } from "../hooks/useFeedback";

const LoginScreen = () => {
  const navigation = useNavigation();
  const { signIn } = useAuth();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const { feedback, showFeedback, hideFeedback } = useFeedback();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const passwordRef = useRef(null);
  const scrollRef = useRef(null);

  const showFeedbackAlert = (title, message, type = "error") => {
    showFeedback({
      type,
      title,
      message,
      confirmText: "OK",
    });
  };

  const validate = () => {
    const next = {};
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      next.email = "Veuillez saisir votre e-mail";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
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
      const normalizedEmail = email.trim().toLowerCase();
      const response = await authService.login(normalizedEmail, password);

      if (response.success && response.data) {
        const { token, user } = response.data;

        logger.debug("LOGIN USER:", user);
        logger.debug("ROLE:", user?.roleName);

        if (token && user) {
          await signIn(token, response.data.refreshToken || "", user);
        } else {
          showFeedbackAlert("Connexion échouée", "Réponse invalide du serveur");
        }
      } else {
        showFeedbackAlert(
          "Connexion échouée",
          response.message || "E-mail ou mot de passe invalide",
        );
      }
    } catch (error) {
      logger.error("Login error:", error);

      if (error?.status === 400 || error?.status === 401) {
        showFeedbackAlert(
          "Connexion échouée",
          "E-mail ou mot de passe invalide",
        );
        return;
      }

      showFeedbackAlert(
        "Erreur",
        error.message ||
          "Échec de la connexion. Veuillez vérifier votre connexion et réessayer.",
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
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      paddingTop: Platform.OS === "android" ? spacing.xl : spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    header: {
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    logoBox: {
      width: 82,
      height: 82,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.surfaceElevated,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    logo: {
      width: 62,
      height: 62,
    },
    brandText: {
      fontSize: typography.xs || 13,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
      fontWeight: typography.medium,
    },
    subtitle: {
      fontSize: typography.xl,
      color: colors.text,
      fontWeight: typography.bold,
      textAlign: "center",
    },
    helperText: {
      marginTop: spacing.xs,
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      paddingHorizontal: spacing.md,
    },
    cardWrapper: {
      width: "100%",
      maxWidth: 390,
      alignSelf: "center",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    forgotButton: {
      alignSelf: "flex-end",
      marginTop: -4,
      marginBottom: spacing.md,
      minHeight: 32,
      justifyContent: "center",
    },
    forgotText: {
      fontSize: typography.sm,
      color: colors.primary,
      fontWeight: typography.semibold,
    },
    signInButton: {
      marginTop: spacing.xs,
      minHeight: 54,
    },
    footer: {
      marginTop: spacing.lg,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
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
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="always"
            keyboardDismissMode="on-drag"
            bounces={false}
          >
            <View style={styles.header}>
              <View style={styles.logoBox}>
                <Image
                  source={require("../assets/checkpoint.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.brandText}>by Triweb</Text>

              <Text style={styles.subtitle}>Bienvenue</Text>

              <Text style={styles.helperText}>
                Connectez-vous pour accéder à votre espace Checkpoint
              </Text>
            </View>

            <View style={styles.cardWrapper}>
              <View style={styles.card}>
                <Input
                  label="Email professionnel"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="vous@entreprise.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  error={errors.email}
                  editable={!loading}
                  testID="auth.emailInput"
                />

                <Input
                  ref={passwordRef}
                  label="Mot de passe"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Votre mot de passe"
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                  returnKeyType="done"
                  onFocus={() => {
                    setTimeout(() => {
                      scrollRef.current?.scrollToEnd({ animated: true });
                    }, 250);
                  }}
                  onSubmitEditing={handleLogin}
                  error={errors.password}
                  editable={!loading}
                  testID="auth.passwordInput"
                />

                <TouchableOpacity
                  activeOpacity={0.75}
                  style={styles.forgotButton}
                  onPress={() => navigation.navigate("ForgotPassword")}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Mot de passe oublié"
                >
                  <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                </TouchableOpacity>

                <Button
                  title="Se connecter"
                  onPress={handleLogin}
                  loading={loading}
                  disabled={loading}
                  style={styles.signInButton}
                  testID="auth.loginButton"
                />

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Pas de compte ? </Text>

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => navigation.navigate("Register")}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Créer un compte"
                  >
                    <Text style={styles.footerLink}>Créez-en un</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <FeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        confirmText={feedback.confirmText}
        cancelText={feedback.cancelText}
        onConfirm={() => {
          feedback.onConfirm?.();
          hideFeedback();
        }}
        onCancel={() => {
          feedback.onCancel?.();
          hideFeedback();
        }}
      />
    </LinearGradient>
  );
};

export default LoginScreen;