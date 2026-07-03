import axiosInstance from './axiosInstance';

export const authService = {
  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise} Response with { success, data: { token, user }, message }
   */
  login: async (email, password) => {
    return await axiosInstance.post('/Auth/login', { email, password });
  },

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise} Response with { success, data: { token }, message }
   */
  refreshAccessToken: async (refreshToken) => {
    return await axiosInstance.post('/Auth/refresh', { refreshToken });
  },

  /**
   * Register new user
   * @param {object} data - Registration data
   * @returns {Promise} Response with { success, data: { token, user }, message }
   */
  register: async (data) => {
    return await axiosInstance.post('/Auth/register', data);
  },

  /**
   * Request a password reset OTP
   * @param {string} email - User email
   * @returns {Promise} Response with { success, message }
   */
  forgotPassword: async (email) => {
    return await axiosInstance.post('/Auth/forgot-password', { email });
  },

  /**
   * Verify password reset OTP
   * @param {string} email - User email
   * @param {string} otpCode - Reset OTP code
   * @returns {Promise} Response with { success, message }
   */
  verifyResetOtp: async (email, otpCode) => {
    return await axiosInstance.post('/Auth/verify-reset-otp', {
      email,
      otpCode,
    });
  },

  /**
   * Reset password using a verified OTP
   * @param {string} email - User email
   * @param {string} otpCode - Reset OTP code
   * @param {string} newPassword - New password
   * @returns {Promise} Response with { success, message }
   */
  resetPassword: async (email, otpCode, newPassword) => {
    return await axiosInstance.post('/Auth/reset-password', {
      email,
      otpCode,
      newPassword,
    });
  },

  /**
   * Get current authenticated user
   * @returns {Promise} Response with { success, data: { user }, message }
   */
  getCurrentUser: async () => {
    return await axiosInstance.get('/Auth/me');
  },
};

