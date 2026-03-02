import axiosInstance from './axiosInstance';

export const roomService = {
  // GET /api/room -> RoomController.GetAllRooms
  getAllRooms: async () => {
    return await axiosInstance.get('/room');
  },

  // GET /api/RoomReservations/for-day -> RoomReservationsController.GetReservationsForDay
  getReservationsForDay: async (roomId, date) => {
    return await axiosInstance.get('/RoomReservations/for-day', {
      params: { roomId, date },
    });
  },

  // POST /api/RoomReservations -> RoomReservationsController.CreateReservation
  createReservation: async (data) => {
    return await axiosInstance.post('/RoomReservations', data);
  },
};

