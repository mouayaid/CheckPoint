import axiosInstance from "./axiosInstance";

export const roomReservationService = {
  async getReservationsForDay(roomId, date) {
    const response = await axiosInstance.get('/RoomReservation/day', {
      params: { roomId, date },
    });
    return response.data;
  },

  async createReservation(payload) {
    const response = await axiosInstance.post('/RoomReservation', payload);
    return response.data;
  },

  async getPendingReservations() {
    const response = await axiosInstance.get('/RoomReservation/pending');
    return response.data;
  },

  async approveReservation(id) {
    const response = await axiosInstance.put(`/RoomReservation/${id}/approve`);
    return response.data;
  },

  async rejectReservation(id, reason) {
    const response = await axiosInstance.put(`/RoomReservation/${id}/reject`, {
      reason,
    });
    return response.data;
  },
};