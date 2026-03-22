import axiosInstance from './axiosInstance';

export const authService = {
  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise} Response with { success, data: { token, user }, message }
   */
  login: async (email, password) => {
    return await axiosInstance.post('/auth/login', { email, password });
  },

  

  /**
   * Register new user
   * @param {object} data - Registration data
   * @returns {Promise} Response with { success, data: { token, user }, message }
   */
  register: async (data) => {
    return await axiosInstance.post('/auth/register', data);
  },

  /**
   * Get current authenticated user
   * @returns {Promise} Response with { success, data: { user }, message }
   */
  getCurrentUser: async () => {
    return await axiosInstance.get('/auth/me');
  },
};

