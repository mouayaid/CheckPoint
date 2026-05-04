import axiosInstance from "./axiosInstance";

export const leaveService = {
  createLeaveRequest: (payload) =>
    axiosInstance.post("/Leave/requests", payload),

  getMyLeaveRequests: () => axiosInstance.get("/Leave/requests/my"),

  approveLeaveRequest: (id, payload = {}) =>
    axiosInstance.put(`/Leave/requests/${id}/approve`, {
      comment: payload?.comment ?? "",
    }),

  rejectLeaveRequest: (id, payload = {}) =>
    axiosInstance.put(`/Leave/requests/${id}/reject`, {
      comment: payload?.comment ?? "",
    }),

  getPendingReviewRequests: async () => {
    try {
      const res = await axiosInstance.get("/Leave/pending-review");

      console.log("RAW LEAVE API RESPONSE:", res);

      const data = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.items)
            ? res.items
            : [];

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.log(
        "LEAVE SERVICE ERROR:",
        error?.response?.data || error.message,
      );

      return {
        success: false,
        data: [],
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Impossible de charger les demandes en attente",
      };
    }
  },

  review: (id, payload) => {
    const isApprove = payload?.decision === "approve";

    return axiosInstance.put(
      `/Leave/requests/${id}/${isApprove ? "approve" : "reject"}`,
      {
        comment: payload?.comment ?? "",
      },
    );
  },
};
