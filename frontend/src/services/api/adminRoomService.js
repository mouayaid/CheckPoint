import api from './axiosInstance';

const extractData = (res) => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return res?.data?.data ?? res?.data ?? null;
};

export const adminRoomService = {
  getAllRooms: () => api.get('/admin/rooms'),
  getRoomById: (id) => api.get(`/admin/rooms/${id}`),
  createRoom: (dto) => api.post('/admin/rooms', dto),
  updateRoom: (id, dto) => api.put(`/admin/rooms/${id}`, dto),
  deleteRoom: (id) => api.delete(`/admin/rooms/${id}`),
  extractData,
};
