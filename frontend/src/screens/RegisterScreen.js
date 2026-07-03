import logger from "../utils/logger";
import React, { useEffect, useState, useRef } from "react";
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
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useNavigation } from "@react-navigation/native";
import { authService, departmentService } from "../services/api";
import { Button, Input } from "../components";
import { useTheme } from "../context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";

const RegisterScreen = () => {
  const navigation = useNavigation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadDepartments = async () => {
      try {
        const data = await departmentService.getDepartments();
        const normalized = data
          .map((item) => ({
            id: item?.id ?? item?.Id,
            name: item?.name ?? item?.Name,
          }))
          .filter((item) => item.id != null && item.name);

        if (isMounted) {
          setDepartments(normalized);
        }
      } catch (error) {
        logger.error("Departments load error:", error);
        if (isMounted) {
          setDepartments([]);
        }
      } finally {
        if (isMounted) {
          setLoadingDepartments(false);
        }
      }
    };

    loadDepartments();

    return () => {
      isMounted = false;
    };
  }, []);

  const validate = () => {
    const next = {};

    if (!fullName.trim()) {
      next.fullName = "Veuillez saisir votre nom complet";
    }

    if (!email.trim()) {
      next.email = "Veuillez saisir votre e-mail";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Veuillez saisir un e-mail valide";
    }

    if (!phoneNumber.trim()) {
      next.phoneNumber = "Veuillez saisir votre numéro de téléphone";
    }

    if (!departmentId) {
      next.departmentId = "Veuillez choisir votre département";
    }

    if (!password) {
      next.password = "Veuillez saisir un mot de passe";
    } else if (password.length < 6) {
      next.password = "Le mot de passe doit contenir au moins 6 caractères";
    }

    if (!confirmPassword) {
      next.confirmPassword = "Veuillez confirmer votre mot de passe";
    } else if (confirmPassword !== password) {
      next.confirmPassword = "Les mots de passe ne correspondent pas";
    }

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
        phoneNumber: phoneNumber.trim(),
        password,
        fullName: fullName.trim(),
        departmentId: Number(departmentId),
      };

      const response = await authService.register(payload);

      if (response.success) {
        Alert.alert(
          "Compte créé",
          "Votre compte a été créé et est en attente de validation par un administrateur. Vous pourrez vous connecter après validation.",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert(
          "Inscription échouée",
          response.message || "Impossible de créer le compte"
        );
      }
    } catch (error) {
      logger.error("Register error:", error);
      Alert.alert(
        "Erreur",
        error.message ||
          "Échec de l'inscription. Veuillez vérifier votre connexion et réessayer."
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
      marginTop: 6,
      fontSize: typography.base,
      color: colors.textSecondary,
      textAlign: "center",
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
    primaryButton: {
      marginTop: 4,
    },
    fieldWrap: {
      marginBottom: spacing.md,
    },
    label: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    pickerContainer: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      overflow: "hidden",
    },
    pickerContainerError: {
      borderColor: colors.error,
    },
    picker: {
      color: colors.text,
      minHeight: 52,
    },
    helperText: {
      fontSize: typography.xs,
      color: colors.textSecondary,
      marginTop: 4,
    },
    errorText: {
      fontSize: typography.xs,
      color: colors.error,
      marginTop: 4,
    },
    footer: {
      marginTop: spacing.xl + 2,
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

              <Text style={styles.title}>Inscription</Text>
              <Text style={styles.subtitle}>
                Créez votre compte et attendez la validation par un administrateur
              </Text>
            </View>

            <View style={styles.card}>
              <Input
                label="Nom complet"
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                autoCapitalize="words"
                blurOnSubmit={false}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                error={errors.fullName}
                editable={!loading}
              />

              <Input
                ref={emailRef}
                label="E-mail professionnel"
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => phoneRef.current?.focus()}
                error={errors.email}
                editable={!loading}
              />

              <Input
                ref={phoneRef}
                label="Numéro de téléphone"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+33 6 12 34 56 78"
                keyboardType="phone-pad"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={errors.phoneNumber}
                editable={!loading}
              />

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Département</Text>
                <View
                  style={[
                    styles.pickerContainer,
                    errors.departmentId && styles.pickerContainerError,
                  ]}
                >
                  <Picker
                    selectedValue={departmentId}
                    onValueChange={(value) => setDepartmentId(value)}
                    enabled={!loading && !loadingDepartments}
                    style={styles.picker}
                  >
                    <Picker.Item
                      label={
                        loadingDepartments
                          ? "Chargement des départements..."
                          : "Choisir un département"
                      }
                      value=""
                    />
                    {departments.map((department) => (
                      <Picker.Item
                        key={department.id}
                        label={department.name}
                        value={String(department.id)}
                      />
                    ))}
                  </Picker>
                </View>
                {errors.departmentId ? (
                  <Text style={styles.errorText}>{errors.departmentId}</Text>
                ) : !loadingDepartments && departments.length === 0 ? (
                  <Text style={styles.helperText}>
                    Aucun département disponible pour le moment.
                  </Text>
                ) : null}
              </View>

              <Input
                ref={passwordRef}
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                blurOnSubmit={false}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                error={errors.password}
                editable={!loading}
              />

              <Input
                ref={confirmPasswordRef}
                label="Confirmer le mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                error={errors.confirmPassword}
                editable={!loading}
              />

              <Button
                title="Créer un compte"
                onPress={handleRegister}
                loading={loading}
                disabled={loading}
                style={styles.primaryButton}
              />

              <View style={styles.footer}>
                <Text style={styles.footerText}>Vous avez déjà un compte ? </Text>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => navigation.goBack()}
                  disabled={loading}
                >
                  <Text style={styles.footerLink}>Retour à la connexion</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default RegisterScreen;
