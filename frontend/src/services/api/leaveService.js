import axiosInstance from "./axiosInstance";

export const leaveService = {
  create: (payload) => axiosInstance.post("/LeaveRequests", payload),
  my: () => axiosInstance.get("/LeaveRequests/my"),
  pending: () => axiosInstance.get("/LeaveRequests/pending"),
};