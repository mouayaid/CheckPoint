import api from './axiosInstance';

const extractData = (res) => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return res?.data?.data ?? res?.data ?? null;
};

export const adminSeatService = {
  getAllSeats: () => api.get('/admin/seats'),
  getSeatById: (id) => api.get(`/admin/seats/${id}`),
  createSeat: (dto) => api.post('/admin/seats', dto),
  updateSeat: (id, dto) => api.put(`/admin/seats/${id}`, dto),
  deleteSeat: (id) => api.delete(`/admin/seats/${id}`),
  extractData,
};
