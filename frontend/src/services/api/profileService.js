import axiosInstance from './axiosInstance';

export const profileService = {
  getProfile: async () => {
    return await axiosInstance.get('/profile/me');
  },
};

