import axiosInstance from './axiosInstance';

export const eventService = {
  createEvent: async (data) => {
    return await axiosInstance.post('/events', data);
  },

  getEventsByDate: async (date) => {
    return await axiosInstance.get('/events', { params: { date } });
  },

  getEventById: async (id) => {
    return await axiosInstance.get(`/events/${id}`);
  },

  rsvpToEvent: async (id, status) => {
    return await axiosInstance.post(`/events/${id}/rsvp`, { status });
  },
};

