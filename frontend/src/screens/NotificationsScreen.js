import React from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../components';
import { colors } from '../theme/theme';

const NotificationsScreen = () => {
  return (
    <View style={styles.container}>
      <EmptyState
        iconName="notifications-outline"
        title="Notifications"
        subtitle="Your notifications will show here. Stay updated on reservations and requests."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default NotificationsScreen;
