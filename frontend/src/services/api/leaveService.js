import api from "./axiosInstance"; // adjust path if your axios file name differs

export const leaveService = {
  create: (payload) => api.post("/LeaveRequests", payload),
  my: () => api.get("/LeaveRequests/my"),
  pending: () => api.get("/LeaveRequests/pending"),
};