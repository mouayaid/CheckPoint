import axiosInstance from './axiosInstance';

export const requestService = {
  // Leave Requests
  createLeaveRequest: async (data) => {
    return await axiosInstance.post('/leave-requests', data);
  },

  getMyLeaveRequests: async () => {
    return await axiosInstance.get('/leave-requests/my');
  },

  getPendingLeaveRequests: async () => {
    return await axiosInstance.get('/leave-requests/pending');
  },

  // Absence Requests
  createAbsenceRequest: async (data) => {
    return await axiosInstance.post('/absence-requests', data);
  },

  getMyAbsenceRequests: async () => {
    return await axiosInstance.get('/absence-requests/my');
  },

  getPendingAbsenceRequests: async () => {
    return await axiosInstance.get('/absence-requests/pending');
  },

  // General Requests
  createGeneralRequest: async (data) => {
    return await axiosInstance.post('/general-requests', data);
  },

  getMyGeneralRequests: async () => {
    return await axiosInstance.get('/general-requests/my');
  },

  getAllGeneralRequests: async (filters = {}) => {
    return await axiosInstance.get('/general-requests', { params: filters });
  },

  assignGeneralRequest: async (id, data) => {
    return await axiosInstance.put(`/general-requests/${id}/assign`, data);
  },

  updateGeneralRequestStatus: async (id, data) => {
    return await axiosInstance.put(`/general-requests/${id}/status`, data);
  },
};

