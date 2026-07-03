import axiosInstance from "./axiosInstance";

const extractData = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return response?.data?.data ?? response?.data ?? response ?? [];
};

export const announcementService = {
  getManageAnnouncements: async () => {
    const response = await axiosInstance.get("/Announcement/manage");
    const data = extractData(response);

    return {
      success: response?.success ?? true,
      message: response?.message,
      data: Array.isArray(data) ? data : [],
    };
  },

  // payload must be a FormData when using Image (multipart/form-data)
  createAnnouncement: (payload) =>
    axiosInstance.post("/Announcement", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // backend Update does not accept image currently (uses UpdateAnnouncementDto with JSON)
  updateAnnouncement: (id, payload) => axiosInstance.put(`/Announcement/${id}`, payload),
  deleteAnnouncement: (id) => axiosInstance.delete(`/Announcement/${id}`),
  extractData,
};
