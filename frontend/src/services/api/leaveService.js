import axiosInstance from "./axiosInstance";

export const leaveService = {
  createLeaveRequest: (payload) =>
    axiosInstance.post("/LeaveRequests", payload),

  getMyLeaveRequests: () =>
    axiosInstance.get("/LeaveRequests/my"),

  getPendingLeaveRequests: () =>
    axiosInstance.get("/LeaveRequests/pending"),

  approveLeaveRequest: (id, payload = {}) =>
    axiosInstance.put(`/LeaveRequests/${id}/approve`, {
      comment: payload?.comment ?? "",
    }),

  rejectLeaveRequest: (id, payload = {}) =>
    axiosInstance.put(`/LeaveRequests/${id}/reject`, {
      comment: payload?.comment ?? "",
    }),

  review: (id, payload) => {
    const isApprove = payload?.decision === "approve";

    return axiosInstance.put(
      `/LeaveRequests/${id}/${isApprove ? "approve" : "reject"}`,
      {
        comment: payload?.comment ?? "",
      }
    );
  },
};