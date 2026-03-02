import React from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../components';
import { colors } from '../theme/theme';

const RoomsScreen = () => {
  return (
    <View style={styles.container}>
      <EmptyState
        iconName="business-outline"
        title="Room reservation"
        subtitle="Pick a room and a time slot to book. This screen will list rooms and let you reserve them."
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

export default RoomsScreen;
