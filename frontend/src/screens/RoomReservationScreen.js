import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { roomService } from '../services/api/roomService';

export default function RoomReservationScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const response = await roomService.getAllRooms();
      if (response.success) {
        setRooms(response.data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load rooms');
    }
  };

  const handleReserve = async () => {
    if (!startTime || !endTime || !purpose) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const startDateTime = new Date(`${selectedDate}T${startTime}`);
    const endDateTime = new Date(`${selectedDate}T${endTime}`);

    if (endDateTime <= startDateTime) {
      Alert.alert('Error', 'End time must be after start time');
      return;
    }

    try {
      const response = await roomService.createReservation({
        roomId: selectedRoom.id,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        purpose,
      });

      if (response.success) {
        Alert.alert('Success', 'Room reserved successfully');
        setModalVisible(false);
        setStartTime('');
        setEndTime('');
        setPurpose('');
        setSelectedRoom(null);
      } else {
        Alert.alert('Error', response.message || 'Failed to reserve room');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to reserve room');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Calendar
        current={selectedDate}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={{
          [selectedDate]: { selected: true, selectedColor: '#007AFF' },
        }}
      />

      <View style={styles.roomsList}>
        {rooms.map((room) => (
          <TouchableOpacity
            key={room.id}
            style={styles.roomItem}
            onPress={() => {
              setSelectedRoom(room);
              setModalVisible(true);
            }}
          >
            <Text style={styles.roomName}>{room.name}</Text>
            <Text style={styles.roomDetails}>
              Floor {room.floor} • Capacity: {room.capacity}
            </Text>
            <View style={styles.roomFeatures}>
              {room.hasProjector && (
                <Text style={styles.feature}>📽️ Projector</Text>
              )}
              {room.hasWhiteboard && (
                <Text style={styles.feature}>📋 Whiteboard</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reserve {selectedRoom?.name}</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Start Time (HH:MM)"
              value={startTime}
              onChangeText={setStartTime}
            />
            <TextInput
              style={styles.input}
              placeholder="End Time (HH:MM)"
              value={endTime}
              onChangeText={setEndTime}
            />
            <TextInput
              style={styles.input}
              placeholder="Purpose"
              value={purpose}
              onChangeText={setPurpose}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.reserveButton]}
                onPress={handleReserve}
              >
                <Text style={styles.buttonText}>Reserve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  roomsList: {
    padding: 15,
  },
  roomItem: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  roomName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  roomDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  roomFeatures: {
    flexDirection: 'row',
    gap: 10,
  },
  feature: {
    fontSize: 12,
    color: '#007AFF',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  reserveButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

