import api from './axiosInstance';

const extractData = (res) => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return res?.data?.data ?? res?.data ?? null;
};

// ─── Office Tables ────────────────────────────────────────────────────────────

export const adminTableService = {
  getAll: () => api.get('/admin/officetables'),
  create: (dto) => api.post('/admin/officetables', dto),
  update: (id, dto) => api.put(`/admin/officetables/${id}`, dto),
  delete: (id) => api.delete(`/admin/officetables/${id}`),
  extractData,
};

// ─── Seats ────────────────────────────────────────────────────────────────────

export const adminSeatService = {
  getAllSeats: () => api.get('/admin/seats'),
  getByTable: (tableId) => api.get(`/admin/seats/by-table/${tableId}`),
  getSeatById: (id) => api.get(`/admin/seats/${id}`),
  createSeat: (dto) => api.post('/admin/seats', dto),
  updateSeat: (id, dto) => api.put(`/admin/seats/${id}`, dto),
  deleteSeat: (id) => api.delete(`/admin/seats/${id}`),
  extractData,
};
