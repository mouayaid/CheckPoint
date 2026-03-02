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
import { useAuth } from '../context/AuthContext';
import api from '../services/api/axiosInstance';

export default function LeaveRequestScreen() {
  const { user } = useAuth();
  if (!user) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Loading...</Text>
    </View>
  );
}
  const [requests, setRequests] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [type, setType] = useState('Vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
  if (user) loadRequests();
}, [user]);

  const loadRequests = async () => {
  try {
    const res = user?.role === 'Employee'
      ? await api.get('/LeaveRequests/my')
      : await api.get('/LeaveRequests/pending');

    // Because your axios interceptor returns response.data directly:
    if (res.success) setRequests(res.data || []);
    else Alert.alert('Error', res.message || 'Failed to load requests');
  } catch (error) {
    Alert.alert('Error', error.message || 'Failed to load requests');
  }
};

  const handleCreate = async () => {
  if (!startDate || !endDate || !reason) {
    Alert.alert('Error', 'Please fill in all fields');
    return;
  }

  try {
    const res = await api.post('/LeaveRequests', {
      type,
      startDate, // format YYYY-MM-DD (works if backend expects Date)
      endDate,
      reason,
    });

    if (res.success) {
      Alert.alert('Success', 'Leave request created');
      setModalVisible(false);
      setReason('');
      setStartDate('');
      setEndDate('');
      await loadRequests();
    } else {
      Alert.alert('Error', res.message || 'Failed to create request');
    }
  } catch (error) {
    Alert.alert('Error', error.message || 'Failed to create request');
  }
};

  const handleReview = async (status) => {
  try {
    const res = await api.put(`/Approvals/leave/${selectedRequest.id}`, {
      status,                 // Approved / Rejected
      managerComment: reviewComment,
    });

    if (res.success) {
      Alert.alert('Success', `Request ${status.toLowerCase()}`);
      setReviewModalVisible(false);
      setReviewComment('');
      await loadRequests();
    } else {
      Alert.alert('Error', res.message || 'Failed to review request');
    }
  } catch (error) {
    Alert.alert('Error', error.message || 'Failed to review request');
  }
};

  const isManager = user?.role === 'Manager' || user?.role === 'Admin';

  return (
    <ScrollView style={styles.container}>
      {!isManager && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>+ Create Leave Request</Text>
        </TouchableOpacity>
      )}

      {requests.map((request) => (
        <View key={request.id} style={styles.requestItem}>
          <Text style={styles.requestType}>{request.type}</Text>
          <Text style={styles.requestDates}>
            {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
          </Text>
          <Text style={styles.requestReason}>{request.reason}</Text>
          <Text style={[styles.requestStatus, { color: getStatusColor(request.status) }]}>
            {request.status}
          </Text>
          {isManager && request.status === 'Pending' && (
            <View style={styles.reviewButtons}>
              <TouchableOpacity
                style={[styles.reviewButton, styles.approveButton]}
                onPress={() => {
                  setSelectedRequest(request);
                  setReviewModalVisible(true);
                }}
              >
                <Text style={styles.reviewButtonText}>Review</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      {/* Create Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Leave Request</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Type (Vacation, Sick, Personal)"
              value={type}
              onChangeText={setType}
            />
            <TextInput
              style={styles.input}
              placeholder="Start Date (YYYY-MM-DD)"
              value={startDate}
              onChangeText={setStartDate}
            />
            <TextInput
              style={styles.input}
              placeholder="End Date (YYYY-MM-DD)"
              value={endDate}
              onChangeText={setEndDate}
            />
            <TextInput
              style={styles.input}
              placeholder="Reason"
              value={reason}
              onChangeText={setReason}
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

      {/* Review Modal */}
      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Review Leave Request</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Comment (optional)"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.rejectButton]}
                onPress={() => handleReview('Rejected')}
              >
                <Text style={styles.buttonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.approveButton]}
                onPress={() => handleReview('Approved')}
              >
                <Text style={styles.buttonText}>Approve</Text>
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
    case 'Approved': return '#4CAF50';
    case 'Rejected': return '#F44336';
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
  requestType: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  requestDates: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  requestReason: {
    fontSize: 14,
    marginBottom: 10,
  },
  requestStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewButtons: {
    flexDirection: 'row',
    marginTop: 10,
  },
  reviewButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  reviewButtonText: {
    color: '#fff',
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

