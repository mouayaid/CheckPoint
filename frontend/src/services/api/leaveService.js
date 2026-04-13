import axiosInstance from "./axiosInstance";

export const leaveService = {
  createLeaveRequest: (payload) =>
    axiosInstance.post("/Leave/requests", payload),

  getMyLeaveRequests: () =>
    axiosInstance.get("/Leave/requests/my"),

  getPendingLeaveRequests: () =>
    axiosInstance.get("/Leave/pending-review"),

  approveLeaveRequest: (id, payload = {}) =>
    axiosInstance.put(`/Leave/requests/${id}/approve`, {
      comment: payload?.comment ?? "",
    }),

  rejectLeaveRequest: (id, payload = {}) =>
    axiosInstance.put(`/Leave/requests/${id}/reject`, {
      comment: payload?.comment ?? "",
    }),

  review: (id, payload) => {
    const isApprove = payload?.decision === "approve";

    return axiosInstance.put(
      `/Leave/requests/${id}/${isApprove ? "approve" : "reject"}`,
      {
        comment: payload?.comment ?? "",
      }
    );
  },
};