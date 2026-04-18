import api from './axiosInstance';

const extractData = (res) => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return res?.data?.data ?? res?.data ?? null;
};

export const adminOfficeTableService = {
  getAllOfficeTables: () => api.get('/admin/officetables'),
  getOfficeTableById: (id) => api.get(`/admin/officetables/${id}`),
  createOfficeTable: (dto) => api.post('/admin/officetables', dto),
  updateOfficeTable: (id, dto) => api.put(`/admin/officetables/${id}`, dto),
  deleteOfficeTable: (id) => api.delete(`/admin/officetables/${id}`),
  extractData,
};
