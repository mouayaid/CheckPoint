import Constants from "expo-constants";
import { Platform } from "react-native";

const configuredApiUrl =
  Constants.expoConfig?.extra?.apiUrl ?? Constants.manifest?.extra?.apiUrl;

const getExpoHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoClient?.hostUri ??
    Constants.manifest?.debuggerHost;

  if (!hostUri) {
    return null;
  }

  // Supports addresses such as:
  // 192.168.1.15:8081
  // exp://192.168.1.15:8081
  return hostUri
    .replace(/^exp:\/\//, "")
    .replace(/^https?:\/\//, "")
    .split(":")[0];
};

const getDevelopmentApiUrl = () => {
  const expoHost = getExpoHost();

  /*
   * Expo Go on a physical device:
   * Expo's Metro address normally contains the computer's current LAN IP.
   */
  if (expoHost && expoHost !== "localhost" && expoHost !== "127.0.0.1") {
    return `http://${expoHost}:5000/api`;
  }

  /*
   * Android emulator fallback:
   * 10.0.2.2 points from the emulator to the computer.
   */
  if (Platform.OS === "android") {
    return "http://10.0.2.2:5000/api";
  }

  return "http://localhost:5000/api";
};

export const API_BASE_URL = __DEV__ ? getDevelopmentApiUrl() : configuredApiUrl;

if (!__DEV__ && !API_BASE_URL) {
  throw new Error(
    "Missing production API URL. Configure EXPO_PUBLIC_PRODUCTION_API_URL or the corresponding staging URL before building.",
  );
}

if (__DEV__) {
  console.log("[API] Base URL:", API_BASE_URL);
}

export const STORAGE_KEYS = {
  USER_TOKEN: "userToken",
  REFRESH_TOKEN: "refreshToken",
  USER_DATA: "userData",
  DEV_API_HOST: "devApiHost",
  REGISTERED_EXPO_PUSH_TOKEN_BY_USER: "registeredExpoPushTokenByUser",
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
