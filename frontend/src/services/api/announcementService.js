import axiosInstance from "./axiosInstance";

export const announcementService = {
  getManageAnnouncements: () => axiosInstance.get("/Announcement/manage"),
  createAnnouncement: (payload) => axiosInstance.post("/Announcement", payload),
  updateAnnouncement: (id, payload) => axiosInstance.put(`/Announcement/${id}`, payload),
  deleteAnnouncement: (id) => axiosInstance.delete(`/Announcement/${id}`),
};