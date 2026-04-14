import axiosInstance from './axiosInstance';

export const eventService = {
  createEvent: async (data) => {
    const response = await axiosInstance.post("/Events", data);
    return response.data;
  },

  getEventsByDate: async (date) => {
    const response = await axiosInstance.get("/Events", { params: { date } });
    return response.data;
  },

  getEventById: async (id) => {
    const response = await axiosInstance.get(`/Events/${id}`);
    return response.data;
  },

  rsvpToEvent: async (id, status) => {
    const response = await axiosInstance.post(`/Events/${id}/rsvp`, { status });
    return response.data;
  },
};