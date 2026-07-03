import axiosInstance from './axiosInstance';

export const eventService = {
  createEvent: (data) => axiosInstance.post("/Events", data),

  getEventsByDate: (date) =>
    axiosInstance.get("/Events", { params: { date } }),

  getEventById: (id) => axiosInstance.get(`/Events/${id}`),

  rsvpToEvent: (id, status) =>
    axiosInstance.post(`/Events/${id}/rsvp`, { status }),
};
