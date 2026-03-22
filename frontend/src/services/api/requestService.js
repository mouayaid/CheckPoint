import axiosInstance from "./axiosInstance";

/**
 * Unified request service that matches backend controllers:
 * - LeaveRequestsController  -> /api/LeaveRequests
 * - AbsenceRequestsController -> /api/AbsenceRequests
 * - GeneralRequestsController -> /api/GeneralRequests
 */
export const requestService = {
  // Leave Requests
  createLeaveRequest: async (data) => {
    return await axiosInstance.post("/LeaveRequests", data);
  },

  getMyLeaveRequests: async () => {
    return await axiosInstance.get("/LeaveRequests/my");
  },

  getPendingLeaveRequests: async () => {
    return await axiosInstance.get("/LeaveRequests/pending");
  },

  // Absence Requests
  createAbsenceRequest: async (data) => {
    return await axiosInstance.post("/AbsenceRequests", data);
  },

  getMyAbsenceRequests: async () => {
    return await axiosInstance.get("/AbsenceRequests/my");
  },

  getPendingAbsenceRequests: async () => {
    return await axiosInstance.get("/AbsenceRequests/pending");
  },

  // General Requests
  createGeneralRequest: async (data) => {
    return await axiosInstance.post("/GeneralRequests", data);
  },

  getMyGeneralRequests: async () => {
    return await axiosInstance.get("/GeneralRequests/my");
  },

  getAllGeneralRequests: async (filters = {}) => {
    return await axiosInstance.get("/GeneralRequests", { params: filters });
  },

  assignGeneralRequest: async (id, data) => {
    return await axiosInstance.put(`/GeneralRequests/${id}/assign`, data);
  },

  updateGeneralRequestStatus: async (id, data) => {
    return await axiosInstance.put(`/GeneralRequests/${id}/status`, data);
  },
};

