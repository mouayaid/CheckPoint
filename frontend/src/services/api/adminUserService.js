import logger from "../../utils/logger";
import api from "./axiosInstance";

const extractData = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return res?.data?.data ?? res?.data ?? res ?? null;
};

export const adminUserService = {
  /** Fetch all users with optional search/filter */
  getAllUsers: ({ search, role, isActive } = {}) => {
    const params = {};
    if (search) params.search = search;
    if (role) params.role = role;
    if (isActive !== undefined && isActive !== null) params.isActive = isActive;
    return api.get("/admin/users", { params });
  },

  /** Fetch pending (unactivated) users */
  getPendingUsers: async () => {
    try {
      const res = await api.get("/admin/users/pending");

      logger.debug("RAW PENDING USERS API RESPONSE:", res);

      const data = extractData(res) ?? [];

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
      };
    } catch (error) {
      logger.debug("PENDING USERS FULL ERROR:", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
      });

      return {
        success: false,
        data: [],
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Impossible de charger les utilisateurs en attente",
      };
    }
  },

  /** Fetch single user by id */
  getUserById: (id) => api.get(`/admin/users/${id}`),

  /** Update user info (name, role, department, leaveBalance) */
  updateUser: (id, dto) => api.put(`/admin/users/${id}`, dto),

  /** Assign / change role only */
  changeRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),

  getRoles: () => api.get("/Roles"),

  getDepartments: () => api.get("/Departments"),

  /** Deactivate a user account without deleting historical data */
  deactivateUser: (id) => api.put(`/admin/users/${id}/deactivate`),

  /** Reactivate a previously deactivated user account */
  reactivateUser: (id) => api.put(`/admin/users/${id}/reactivate`),

  /** Compatibility alias for older callers; backend also performs a soft delete. */
  deleteUser: (id) => api.put(`/admin/users/${id}/deactivate`),

  /** Approve pending user */
  approveUser: (id, dto) => api.put(`/admin/users/${id}/approve`, dto),

  /** Reject pending user */
  rejectUser: (id, reason) => api.put(`/admin/users/${id}/reject`, { reason }),

  extractData,
};
