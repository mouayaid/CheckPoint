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
};

export default roomService;
