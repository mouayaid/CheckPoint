import logger from "../utils/logger";
import React, { useMemo, useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { authService } from "../services/api";
import { Button, Input } from "../components";
import FeedbackModal from "../components/FeedbackModal";
import { useFeedback } from "../hooks/useFeedback";
import { useTheme } from "../context/ThemeContext";

const ForgotPasswordScreen = ({ navigation }) => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const { feedback, showFeedback, hideFeedback } = useFeedback();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const normalizedEmail = useMemo(() => email.trim(), [email]);

  const showMessage = (type, title, message, onConfirm) => {
    showFeedback({
      type,
      title,
      message,
      confirmText: "OK",
      onConfirm,
    });
  };

  const validate = () => {
    const next = {};

    if (!normalizedEmail) {
      next.email = "Veuillez saisir votre e-mail";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      next.email = "Veuillez saisir un e-mail valide";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const response = await authService.forgotPassword(normalizedEmail);

      if (response?.success) {
        showMessage(
          "success",
          "E-mail envoye",
          response.message ||
            "Si ce compte existe, vous recevrez les instructions de reinitialisation.",
          () => navigation.navigate("Login"),
        );
      } else {
        showMessage(
          "error",
          "Envoi impossible",
          response?.message ||
            "Impossible d'envoyer les instructions de reinitialisation.",
        );
      }
    } catch (error) {
      logger.error("Forgot password error:", error);
      showMessage(
        "error",
        "Erreur",
        error?.message ||
          "Impossible de contacter le serveur. Veuillez reessayer.",
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
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxxl,
    },
    header: {
      alignItems: "center",
      marginBottom: spacing.xxl,
    },
    logoBox: {
      width: 96,
      height: 96,
      borderRadius: borderRadius.xl + 4,
      backgroundColor: colors.surfaceElevated,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    logo: {
      width: 74,
      height: 74,
    },
    title: {
      fontSize: typography.xxl,
      color: colors.text,
      fontWeight: typography.bold,
      textAlign: "center",
    },
    subtitle: {
      marginTop: spacing.sm,
      fontSize: typography.base,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
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
    helperText: {
      color: colors.textSecondary,
      fontSize: typography.sm,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    submitButton: {
      marginTop: spacing.xs,
    },
    footer: {
      marginTop: spacing.xl,
      alignItems: "center",
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
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View style={styles.logoBox}>
                <Image
                  source={require("../assets/checkpoint.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.title}>Mot de passe oublie</Text>
              <Text style={styles.subtitle}>
                Entrez votre e-mail professionnel pour recevoir les instructions.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.helperText}>
                Nous enverrons un message de recuperation si un compte correspond
                a cette adresse.
              </Text>

              <Input
                label="Email professionnel"
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
                error={errors.email}
                editable={!loading}
              />

              <Button
                title="Envoyer les instructions"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={styles.submitButton}
              />

              <View style={styles.footer}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate("Login")}
                  disabled={loading}
                >
                  <Text style={styles.footerLink}>Retour a la connexion</Text>
                </TouchableOpacity>
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

export default ForgotPasswordScreen;
