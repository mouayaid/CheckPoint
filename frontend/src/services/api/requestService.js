import axiosInstance from "./axiosInstance";

export const requestService = {
  createGeneralRequest: async (data) => {
    return await axiosInstance.post("/GeneralRequests", data);
  },

  getMyGeneralRequests: async () => {
    return await axiosInstance.get("/GeneralRequests/my");
  },

  getAllGeneralRequests: async (filters = {}) => {
    return await axiosInstance.get("/GeneralRequests", { params: filters });
  },

  updateGeneralRequestStatus: async (id, data) => {
    return await axiosInstance.put(`/GeneralRequests/${id}/status`, data);
  },

  approveGeneralRequest: async (id, data = {}) => {
    return await axiosInstance.put(`/GeneralRequests/${id}/approve`, data);
  },

  rejectGeneralRequest: async (id, data = {}) => {
    return await axiosInstance.put(`/GeneralRequests/${id}/reject`, data);
  },
};
