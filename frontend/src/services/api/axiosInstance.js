import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend API URL
// - iOS Simulator: localhost
// - Android Emulator: 10.0.2.2 (alias for host machine)
// - Physical device: set API_HOST below to your PC's IP (e.g. 192.168.1.10)
const API_HOST = '192.168.1.59'; // e.g. '192.168.1.10' for real device
const getBaseUrl = () => {
  if (!__DEV__) return 'https://your-api-domain.com/api';
  if (API_HOST) return `http://${API_HOST}:5000/api`;
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api'
    : 'http://localhost:5000/api';
};
const BASE_URL = getBaseUrl();

// Create axios instance
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to requests
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token from storage:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
axiosInstance.interceptors.response.use(
  (response) => {
    // Return data directly (assuming backend returns { success, data, message })
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      try {
        // Clear stored auth data
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userData');
        
        // You can dispatch a logout action here if using Redux/Context
        // For now, we'll just reject the promise
      } catch (storageError) {
        console.error('Error clearing storage:', storageError);
      }
    }

    // Handle network errors
    if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }

    // Return error in consistent format
    return Promise.reject({
      message: error.response?.data?.message || error.message || 'An error occurred',
      status: error.response?.status,
      data: error.response?.data,
    });
  }
);

// Helper method to set auth token (useful for login)
axiosInstance.setAuthToken = async (token) => {
  if (token) {
    await AsyncStorage.setItem('userToken', token);
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    await AsyncStorage.removeItem('userToken');
    delete axiosInstance.defaults.headers.common['Authorization'];
  }
};

// Helper method to clear auth token (useful for logout)
axiosInstance.clearAuthToken = async () => {
  await AsyncStorage.removeItem('userToken');
  await AsyncStorage.removeItem('userData');
  delete axiosInstance.defaults.headers.common['Authorization'];
};

export default axiosInstance;

