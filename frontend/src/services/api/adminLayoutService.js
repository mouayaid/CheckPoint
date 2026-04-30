import api from './axiosInstance';

export const adminLayoutService = {
  getAdminLayout: () => api.get("/admin/layout"),

  extractData: (res) => res?.data?.data ?? res?.data,
};