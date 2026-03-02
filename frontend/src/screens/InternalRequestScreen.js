import React, { useState, useEffect, useContext } from 'react';
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
import AuthContext from '../context/AuthContext';
import { internalRequestAPI } from '../services/apiService';

export default function InternalRequestScreen() {
  const { user } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [category, setCategory] = useState('HR');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = user?.role === 'Admin'
        ? await internalRequestAPI.getRequestsByCategory(category)
        : await internalRequestAPI.getMyRequests();
      
      if (response.success) {
        setRequests(response.data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load requests');
    }
  };

  const handleCreate = async () => {
    if (!title || !description) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const response = await internalRequestAPI.createRequest({
        category,
        title,
        description,
      });

      if (response.success) {
        Alert.alert('Success', 'Request created successfully');
        setModalVisible(false);
        setTitle('');
        setDescription('');
        loadRequests();
      } else {
        Alert.alert('Error', response.message || 'Failed to create request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create request');
    }
  };

  const isAdmin = user?.role === 'Admin';

  return (
    <ScrollView style={styles.container}>
      {!isAdmin && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>+ Create Internal Request</Text>
        </TouchableOpacity>
      )}

      {requests.map((request) => (
        <View key={request.id} style={styles.requestItem}>
          <Text style={styles.requestCategory}>{request.category}</Text>
          <Text style={styles.requestTitle}>{request.title}</Text>
          <Text style={styles.requestDescription}>{request.description}</Text>
          <Text style={[styles.requestStatus, { color: getStatusColor(request.status) }]}>
            {request.status}
          </Text>
        </View>
      ))}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Internal Request</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Category (HR, IT, Admin)"
              value={category}
              onChangeText={setCategory}
            />
            <TextInput
              style={styles.input}
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
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
                style={[styles.button, styles.createButtonStyle]}
                onPress={handleCreate}
              >
                <Text style={styles.buttonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getStatusColor = (status) => {
  switch (status) {
    case 'Resolved': return '#4CAF50';
    case 'Rejected': return '#F44336';
    case 'InProgress': return '#2196F3';
    default: return '#FF9800';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  requestItem: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  requestCategory: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 5,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  requestDescription: {
    fontSize: 14,
    marginBottom: 10,
    color: '#666',
  },
  requestStatus: {
    fontSize: 14,
    fontWeight: '600',
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
  createButtonStyle: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

