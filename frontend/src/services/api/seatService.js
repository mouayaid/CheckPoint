import axiosInstance from './axiosInstance';

export const seatService = {
  getSeatMap: async (date) => {
    return await axiosInstance.get('/Seats/map', { params: { date } });
  },

  createReservation: async (seatId, date) => {
    return await axiosInstance.post('/SeatReservations', { seatId, date });
  },

  cancelReservation: async (id) => {
    return await axiosInstance.delete(`/SeatReservations/${id}`);
  },
};