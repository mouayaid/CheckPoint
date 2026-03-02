import React from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../components';
import { colors } from '../theme/theme';

const RequestsScreen = () => {
  return (
    <View style={styles.container}>
      <EmptyState
        iconName="document-text-outline"
        title="Requests"
        subtitle="Leave, absence, and general requests will appear here. Create and track your requests."
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

export default RequestsScreen;
