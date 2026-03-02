import axiosInstance from './axiosInstance';

export const notificationService = {
  getNotifications: async () => {
    return await axiosInstance.get('/notifications');
  },

  markAsRead: async (id) => {
    return await axiosInstance.put(`/notifications/${id}/read`);
  },
};

