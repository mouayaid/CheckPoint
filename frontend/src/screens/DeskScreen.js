import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const DeskScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Desk Reservation</Text>
      <Text style={styles.subtitle}>Seat map and reservations</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});

export default DeskScreen;

