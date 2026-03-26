import axiosInstance from "./axiosInstance";

export const leaveService = {
  create: (payload) => axiosInstance.post("/Leave/requests", payload),

  my: () => axiosInstance.get("/Leave/requests/my"),

  pending: () => axiosInstance.get("/Leave/requests/pending"),

  review: (id, payload) =>
    axiosInstance.put(`/Leave/requests/${id}/review`, payload),
};