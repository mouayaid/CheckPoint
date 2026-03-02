import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components';
import { colors, spacing, typography } from '../theme/theme';

const ProfileScreen = () => {
  const { user, signOut } = useAuth();

  const displayName = user?.fullName || user?.firstName
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.fullName
    : 'User';
  const email = user?.email || '';
  const role = user?.role || '';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatarWrap}>
          <Ionicons name="person" size={40} color={colors.primary} />
        </View>
        <Text style={styles.name}>{displayName}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}
        {role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{role}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button
          title="Log out"
          variant="danger"
          onPress={() => signOut()}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  name: {
    fontSize: typography.xxl,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  roleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.borderLight,
    borderRadius: 8,
  },
  roleText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  footer: {
    paddingBottom: spacing.xl,
  },
});

export default ProfileScreen;
