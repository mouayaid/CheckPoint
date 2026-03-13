import React, { useState, useRef } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { authService } from "../services/api";
import { Button, Input } from "../components";
import { colors, spacing, typography } from "../theme/theme";
import { LinearGradient } from "expo-linear-gradient";

const DEFAULT_DEPARTMENT_ID = 1;

const RegisterScreen = () => {
  const navigation = useNavigation();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const validate = () => {
    const next = {};

    if (!fullName.trim()) {
      next.fullName = "Please enter your full name";
    }

    if (!email.trim()) {
      next.email = "Please enter your email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Please enter a valid email";
    }

    if (!password) {
      next.password = "Please enter a password";
    } else if (password.length < 6) {
      next.password = "Password must be at least 6 characters";
    }

    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password";
    } else if (confirmPassword !== password) {
      next.confirmPassword = "Passwords do not match";
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
        password,
        fullName: fullName.trim(),
        departmentId: DEFAULT_DEPARTMENT_ID,
      };

      const response = await authService.register(payload);

      if (response.success) {
        Alert.alert(
          "Account created",
          "Your account is created and waiting for admin approval. You can login after approval.",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ],
        );
      } else {
        Alert.alert(
          "Registration failed",
          response.message || "Unable to create account",
        );
      }
    } catch (error) {
      console.error("Register error:", error);
      Alert.alert(
        "Error",
        error.message ||
          "Registration failed. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#EF4444", "#DC2626", "#B91C1C"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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

              <Text style={styles.subtitle}>Register to request access</Text>
            </View>

            <View style={styles.card}>
              <Input
                label="Full name"
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
                label="Professional email"
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
                label="Password"
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
                label="Confirm password"
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
                title="Create account"
                onPress={handleRegister}
                loading={loading}
                disabled={loading}
                style={styles.primaryButton}
              />

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => navigation.goBack()}
                  disabled={loading}
                >
                  <Text style={styles.footerLink}>Back to login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
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
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 5,
  },
  logo: {
    width: 74,
    height: 74,
  },
  brandText: {
    fontSize: typography.sm,
    color: "#FFE5E5",
    marginBottom: 8,
    fontWeight: "500",
  },
  title: {
    fontSize: typography.xxl,
    color: colors.white,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    fontSize: typography.base,
    color: "#FFE5E5",
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButton: {
    marginTop: 4,
  },
  footer: {
    marginTop: 22,
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
    fontWeight: "700",
  },
});

export default RegisterScreen;
