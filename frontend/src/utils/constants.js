// App Constants
export const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:5000/api'
  : 'https://your-api-domain.com/api';

export const STORAGE_KEYS = {
  USER_TOKEN: 'userToken',
  USER_DATA: 'userData',
};

export const ROUTES = {
  LOGIN: 'Login',
  HOME_TABS: 'HomeTabs',
  DESK: 'Desk',
  ROOMS: 'Rooms',
  REQUESTS: 'Requests',
  EVENTS: 'Events',
  NOTIFICATIONS: 'Notifications',
  PROFILE: 'Profile',
};

