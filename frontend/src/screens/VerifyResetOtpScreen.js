import React, { useEffect, useMemo, useState } from "react";
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

const RESEND_COOLDOWN_SECONDS = 60;

const VerifyResetOtpScreen = ({ navigation, route }) => {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const { feedback, showFeedback, hideFeedback } = useFeedback();

  const email = useMemo(
    () => String(route?.params?.email || "").trim().toLowerCase(),
    [route?.params?.email],
  );

  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errors, setErrors] = useState({});

  const cleanOtpCode = useMemo(() => otpCode.trim(), [otpCode]);
  const isResendBlocked = resendCooldown > 0;

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;

    const timer = setTimeout(() => {
      setResendCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCooldown]);

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

    if (!email) {
      next.email =
        "Adresse e-mail manquante. Veuillez recommencer la récupération.";
    }

    if (!cleanOtpCode) {
      next.otpCode = "Veuillez saisir le code de vérification";
    } else if (!/^\d{6}$/.test(cleanOtpCode)) {
      next.otpCode = "Le code doit contenir 6 chiffres";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleVerify = async () => {
    if (loading || !validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const response = await authService.verifyResetOtp(email, cleanOtpCode);

      if (response?.success) {
        navigation.navigate("ResetPassword", {
          email,
          otpCode: cleanOtpCode,
        });
      } else {
        showMessage(
          "error",
          "Code invalide",
          response?.message || "Le code est invalide ou a expiré.",
        );
      }
    } catch (error) {
      showMessage(
        "error",
        "Vérification impossible",
        getApiErrorMessage(error, "Le code est invalide ou a expiré."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || isResendBlocked) return;

    if (!email) {
      showMessage(
        "error",
        "E-mail manquant",
        "Veuillez recommencer la récupération du mot de passe.",
        () => navigation.navigate("ForgotPassword"),
      );
      return;
    }

    setResending(true);

    try {
      const response = await authService.forgotPassword(email);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      showMessage(
        response?.success ? "success" : "error",
        response?.success ? "Code renvoyé" : "Renvoi impossible",
        response?.message ||
          (response?.success
            ? "Un nouveau code a été envoyé si ce compte existe."
            : "Impossible de renvoyer le code pour le moment."),
      );
    } catch (error) {
      showMessage(
        "error",
        "Renvoi impossible",
        getApiErrorMessage(
          error,
          "Impossible de renvoyer le code. Veuillez réessayer.",
        ),
      );
    } finally {
      setResending(false);
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
    emailText: {
      color: colors.text,
      fontWeight: typography.semibold,
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
      marginTop: spacing.sm,
    },
    disabledLink: {
      opacity: 0.5,
    },
    inlineError: {
      color: colors.error,
      fontSize: typography.sm,
      lineHeight: 20,
      marginBottom: spacing.md,
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

              <Text style={styles.title}>Vérification du code</Text>
              <Text style={styles.subtitle}>
                Saisissez le code envoyé à votre adresse e-mail.
              </Text>
            </View>

            <View style={styles.card}>
              {!email || errors.email ? (
                <Text style={styles.inlineError}>
                  {errors.email ||
                    "Adresse e-mail manquante. Veuillez recommencer la récupération."}
                </Text>
              ) : (
                <Text style={styles.helperText}>
                  Un code de vérification a été envoyé à{" "}
                  <Text style={styles.emailText}>{email}</Text>.
                </Text>
              )}

              <Input
                label="Code de vérification"
                value={otpCode}
                onChangeText={(value) => setOtpCode(value.replace(/[^\d]/g, ""))}
                placeholder="123456"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoComplete="one-time-code"
                returnKeyType="done"
                maxLength={6}
                onSubmitEditing={handleVerify}
                error={errors.otpCode}
                editable={!loading}
              />

              <Button
                title="Vérifier le code"
                onPress={handleVerify}
                loading={loading}
                disabled={loading || !email}
                style={styles.submitButton}
              />

              <View style={styles.footer}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handleResend}
                  disabled={resending || isResendBlocked || !email}
                  style={[
                    (resending || isResendBlocked || !email) &&
                      styles.disabledLink,
                  ]}
                >
                  <Text style={styles.footerLink}>
                    {resending
                      ? "Renvoi en cours..."
                      : resendCooldown > 0
                        ? `Renvoyer le code (${resendCooldown}s)`
                        : "Renvoyer le code"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate("Login")}
                  disabled={loading || resending}
                >
                  <Text style={styles.footerLink}>Retour à la connexion</Text>
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

export default VerifyResetOtpScreen;
