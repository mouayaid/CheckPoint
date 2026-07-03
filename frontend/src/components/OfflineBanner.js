import React from "react";
import { View, Text, StyleSheet } from "react-native";

const OfflineBanner = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        No internet connection
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#d32f2f",
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "white",
    fontWeight: "600",
    fontSize: 13,
  },
});

export default OfflineBanner;