import React from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../components';
import { colors } from '../theme/theme';

const EventsScreen = () => {
  return (
    <View style={styles.container}>
      <EmptyState
        iconName="calendar-outline"
        title="Events"
        subtitle="Company events and calendar. View events by date and RSVP when enabled."
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

export default EventsScreen;
