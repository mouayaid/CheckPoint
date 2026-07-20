import axiosInstance from './axiosInstance';

export const profileService = {
  getProfile: async () => {
    return await axiosInstance.get('/profile/me');
  },
  updateMyProfile: async (payload) => {
    return await axiosInstance.put('/Profile/me', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
