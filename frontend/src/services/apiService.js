import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/constants';

const apiService = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let authToken = null;

apiService.setAuthToken = (token) => {
  authToken = token;
  if (token) {
    apiService.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiService.defaults.headers.common['Authorization'];
  }
};

// Request interceptor
apiService.interceptors.request.use(
  async (config) => {
    if (!authToken) {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        authToken = token;
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiService.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      authToken = null;
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (email, password) => apiService.post('/auth/login', { email, password }),
  register: (data) => apiService.post('/auth/register', data),
  getCurrentUser: () => apiService.get('/auth/me'),
};

// Desk
export const deskAPI = {
  getAllDesks: () => apiService.get('/desk'),
  getDesksByFloor: (floor) => apiService.get(`/desk/floor/${floor}`),
  createReservation: (data) => apiService.post('/desk/reservations', data),
  getMyReservations: () => apiService.get('/desk/reservations/my'),
  cancelReservation: (id) => apiService.delete(`/desk/reservations/${id}`),
};

// Room
export const roomAPI = {
  getAllRooms: () => apiService.get('/room'),
  getAvailableTimeSlots: (roomId, date) => apiService.get(`/room/${roomId}/availability`, { params: { date } }),
  createReservation: (data) => apiService.post('/room/reservations', data),
  getMyReservations: () => apiService.get('/room/reservations/my'),
  cancelReservation: (id) => apiService.delete(`/room/reservations/${id}`),
};

// Leave
export const leaveAPI = {
  createRequest: (data) => apiService.post('/leave/requests', data),
  getMyRequests: () => apiService.get('/leave/requests/my'),
  getPendingRequests: () => apiService.get('/leave/requests/pending'),
  reviewRequest: (id, data) => apiService.put(`/leave/requests/${id}/review`, data),
};

// Internal Request
export const internalRequestAPI = {
  createRequest: (data) => apiService.post('/internalrequest', data),
  getMyRequests: () => apiService.get('/internalrequest/my'),
  getRequestsByCategory: (category) => apiService.get(`/internalrequest/category/${category}`),
  updateRequestStatus: (id, data) => apiService.put(`/internalrequest/${id}/status`, data),
};

// Event
export const eventAPI = {
  createEvent: (data) => apiService.post('/event', data),
  getEventsByDate: (date) => apiService.get(`/event/date/${date}`),
  getUpcomingEvents: (days = 7) => apiService.get('/event/upcoming', { params: { days } }),
  deleteEvent: (id) => apiService.delete(`/event/${id}`),
};

// Notification
export const notificationAPI = {
  getMyNotifications: () => apiService.get('/notification'),
  markAsRead: (id) => apiService.put(`/notification/${id}/read`),
  markAllAsRead: () => apiService.put('/notification/read-all'),
};

// Profile
export const profileAPI = {
  getProfile: () => apiService.get('/profile'),
  updateProfile: (data) => apiService.put('/profile', data),
  getHistory: () => apiService.get('/profile/history'),
};

export default apiService;

