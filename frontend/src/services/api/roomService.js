import axiosInstance from "./axiosInstance";

const roomService = {
  // GET /api/room -> RoomController.GetAllRooms
  getAllRooms: async () => {
    const res = await axiosInstance.get("/room");
    return res;
  },

  getMyReservations: async () => {
    const res = await axiosInstance.get("/room/reservations/my");
    return res;
  },

  cancelReservation: async (id) => {
    const res = await axiosInstance.delete(`/room/reservations/${id}`);
    return res;
  },

  // GET /api/RoomReservations/for-day
  getReservationsForDay: async (roomId, date) => {
    const res = await axiosInstance.get("/RoomReservations/for-day", {
      params: { roomId, date },
    });
    return res;
  },

  // POST /api/RoomReservations
  createReservation: async (data) => {
    const res = await axiosInstance.post("/RoomReservations", data);
    return res;
  },
};

export default roomService;
