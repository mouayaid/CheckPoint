import axiosInstance from "./axiosInstance";

export const roomReservationService = {
  async getReservationsForDay(roomId, date) {
    return axiosInstance.get("/RoomReservations/for-day", {
      params: { roomId, date },
    });
  },

  async createReservation(payload) {
    return axiosInstance.post("/RoomReservations", payload);
  },

  async scanStart(resId, roomId) {
    return axiosInstance.post(`/RoomReservations/${resId}/scan-start`, {
      scannedRoomId: roomId,
    });
  },

  async finishReservation(resId) {
    return axiosInstance.post(`/RoomReservations/${resId}/finish`);
  },

  async cancelReservation(resId) {
    return axiosInstance.post(`/RoomReservations/${resId}/cancel`);
  },
};
