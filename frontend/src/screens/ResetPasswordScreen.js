import React, { useMemo, useRef, useState } from "react";
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
import { getApiErrorMessage } from "../utils/apiErrors";

const ResetPasswordScreen = ({ navigation, route }) => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const { feedback, showFeedback, hideFeedback } = useFeedback();

  const email = useMemo(
    () => String(route?.params?.email || "").trim().toLowerCase(),
    [route?.params?.email],
  );
  const otpCode = useMemo(
    () => String(route?.params?.otpCode || "").trim(),
    [route?.params?.otpCode],
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const confirmPasswordRef = useRef(null);
  const hasValidResetSession = email && /^\d{6}$/.test(otpCode);

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

    if (!hasValidResetSession) {
      next.form =
        "Session de vérification invalide. Veuillez recommencer la récupération.";
    }

    if (!newPassword) {
      next.newPassword = "Veuillez saisir un nouveau mot de passe";
    } else if (newPassword.length < 8) {
      next.newPassword =
        "Le mot de passe doit contenir au moins 8 caractères";
    } else if (newPassword.length > 100) {
      next.newPassword =
        "Le mot de passe doit contenir 100 caractères au maximum";
    }

    if (!confirmPassword) {
      next.confirmPassword = "Veuillez confirmer votre mot de passe";
    } else if (confirmPassword !== newPassword) {
      next.confirmPassword = "Les mots de passe ne correspondent pas";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleResetPassword = async () => {
    if (loading || !validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const response = await authService.resetPassword(
        email,
        otpCode,
        newPassword,
      );

      if (response?.success) {
        showMessage(
          "success",
          "Mot de passe réinitialisé",
          "Votre mot de passe a été réinitialisé avec succès.",
          () =>
            navigation.reset({
              index: 0,
              routes: [{ name: "Login" }],
            }),
        );
      } else {
        showMessage(
          "error",
          "Réinitialisation impossible",
          response?.message ||
            "Impossible de réinitialiser le mot de passe.",
        );
      }
    } catch (error) {
      showMessage(
        "error",
        "Réinitialisation impossible",
        getApiErrorMessage(
          error,
          "Impossible de réinitialiser le mot de passe. Veuillez réessayer.",
        ),
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
    inlineError: {
      color: colors.error,
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

              <Text style={styles.title}>Nouveau mot de passe</Text>
              <Text style={styles.subtitle}>
                Choisissez un nouveau mot de passe pour votre compte.
              </Text>
            </View>

            <View style={styles.card}>
              {!hasValidResetSession || errors.form ? (
                <Text style={styles.inlineError}>
                  {errors.form ||
                    "Session de vérification invalide. Veuillez recommencer la récupération."}
                </Text>
              ) : (
                <Text style={styles.helperText}>
                  Votre code est vérifié. Définissez votre nouveau mot de passe.
                </Text>
              )}

              <Input
                label="Nouveau mot de passe"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Votre nouveau mot de passe"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                blurOnSubmit={false}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                error={errors.newPassword}
                editable={!loading}
              />

              <Input
                ref={confirmPasswordRef}
                label="Confirmer le mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirmez votre mot de passe"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
                error={errors.confirmPassword}
                editable={!loading}
              />

              <Button
                title="Réinitialiser le mot de passe"
                onPress={handleResetPassword}
                loading={loading}
                disabled={loading || !hasValidResetSession}
                style={styles.submitButton}
              />

              <View style={styles.footer}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate("ForgotPassword")}
                  disabled={loading}
                >
                  <Text style={styles.footerLink}>
                    Recommencer la récupération
                  </Text>
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

export default ResetPasswordScreen;
