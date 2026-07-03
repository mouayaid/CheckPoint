import Constants from "expo-constants";

const configuredApiUrl =
  Constants.expoConfig?.extra?.apiUrl ??
  Constants.manifest?.extra?.apiUrl;

export const API_BASE_URL = __DEV__
  ? "http://10.0.2.2:5000/api"
  : configuredApiUrl;

if (!__DEV__ && !API_BASE_URL) {
  throw new Error(
    "Missing production API URL. Configure EXPO_PUBLIC_PRODUCTION_API_URL (or staging equivalent) before building."
  );
}

export const STORAGE_KEYS = {
  USER_TOKEN: "userToken",
  REFRESH_TOKEN: "refreshToken",
  USER_DATA: "userData",
};

export const ROUTES = {
  LOGIN: "Login",
  HOME_TABS: "HomeTabs",
  DESK: "Desk",
  ROOMS: "Rooms",
  REQUESTS: "Requests",
  EVENTS: "Events",
  NOTIFICATIONS: "Notifications",
  PROFILE: "Profile",
};