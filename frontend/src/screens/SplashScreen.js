import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const SplashScreen = () => {
  const navigation = useNavigation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

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
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxxl,
    },
    header: {
      alignItems: 'center',
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
      opacity: 0.8,
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
              <Text style={styles.subtitle}>Checkpoint</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default SplashScreen;
