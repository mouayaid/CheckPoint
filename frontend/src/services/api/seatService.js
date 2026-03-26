import axiosInstance from "./axiosInstance";

export const seatService = {
  getSeatMap: async (date) => {
    return await axiosInstance.get("/Seats/map", { params: { date } });
  },

  createReservation: async (seatId, date) => {
    return await axiosInstance.post("/SeatReservations", { seatId, date });
  },

  getMyTodayReservation: async () => {
    return await axiosInstance.get("/SeatReservations/my-today");
  },

  cancelReservation: async (id) => {
    return await axiosInstance.delete(`/SeatReservations/${id}`);
  },
  cancelMyTodayReservation: async () => {
    return await axiosInstance.delete("/SeatReservations/my-today");
  },
};
export const profileService = {
  getMyProfile: async () => {
    return await axiosInstance.get("/Profile/me");
  },
};
