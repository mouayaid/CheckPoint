import api from './axiosInstance';

const extractData = (res) => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return res?.data?.data ?? res?.data ?? null;
};

export const adminUserService = {
  /** Fetch all users with optional search/filter */
  getAllUsers: ({ search, role, isActive } = {}) => {
    const params = {};
    if (search) params.search = search;
    if (role) params.role = role;
    if (isActive !== undefined && isActive !== null) params.isActive = isActive;
    return api.get('/admin/users', { params });
  },

  /** Fetch pending (unactivated) users */
  getPendingUsers: () => api.get('/admin/users/pending'),

  /** Fetch single user by id */
  getUserById: (id) => api.get(`/admin/users/${id}`),

  /** Update user info (name, role, department, leaveBalance) */
  updateUser: (id, dto) => api.put(`/admin/users/${id}`, dto),

  /** Assign / change role only */
  changeRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),

  /** Delete a user permanently */
  deleteUser: (id) => api.delete(`/admin/users/${id}`),

  /** Approve pending user */
  approveUser: (id, dto) => api.put(`/admin/users/${id}/approve`, dto),

  /** Reject pending user */
  rejectUser: (id, reason) => api.put(`/admin/users/${id}/reject`, { reason }),

  extractData,
};
