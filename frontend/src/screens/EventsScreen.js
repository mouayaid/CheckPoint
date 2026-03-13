import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import api from "../services/api/axiosInstance";
import { EmptyState } from "../components";
import { colors } from "../theme/theme";

const EventsScreen = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const res = await api.get("/event/upcoming");
      if (res.success) setEvents(res.data || []);
    } catch (err) {
      console.log(err);
    }
  };

  if (events.length === 0) {
    return (
      <EmptyState
        iconName="calendar-outline"
        title="No events"
        subtitle="There are no upcoming events."
      />
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          <Text>{new Date(item.date).toLocaleDateString()}</Text>
          <Text>{item.description}</Text>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    margin: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
  },
  title: {
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default EventsScreen;