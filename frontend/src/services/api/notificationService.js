import axiosInstance from "./axiosInstance";

export const notificationService = {
  /**
   * Get notifications for the current user.
   * Backend route: GET /api/Notifications
   */
  getNotifications: async () => {
    return await axiosInstance.get("/Notifications");
  },

  /**
   * Mark a single notification as read.
   * Backend route: PUT /api/Notifications/{id}/read
   */
  markAsRead: async (id) => {
    return await axiosInstance.put(`/Notifications/${id}/read`);
  },

  /**
   * Mark all notifications as read.
   * Backend route: PUT /api/Notifications/read-all
   */
  markAllAsRead: async () => {
    return await axiosInstance.put("/Notifications/read-all");
  },
};

