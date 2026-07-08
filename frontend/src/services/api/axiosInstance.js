import axios from "axios";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { STORAGE_KEYS } from "../../utils/constants";
import { isE2EMode } from "../../utils/e2eMode";
import logger from "../../utils/logger";

const API_HOST = Constants.expoConfig?.extra?.apiHost || null;

const getBaseUrl = () => {
  if (isE2EMode()) {
    return Constants.expoConfig?.extra?.e2eApiUrl || "http://10.0.2.2:5000/api";
  }

  if (!__DEV__) {
    const productionApiUrl =
      Constants.expoConfig?.extra?.apiUrl ?? Constants.manifest?.extra?.apiUrl;

    if (!productionApiUrl) {
      throw new Error(
        "Missing production API URL. Configure EXPO_PUBLIC_PRODUCTION_API_URL or EXPO_PUBLIC_STAGING_API_URL before building.",
      );
    }

    return productionApiUrl;
  }

  if (API_HOST) return `http://${API_HOST}:5000/api`;

  return Platform.OS === "android"
    ? "http://10.0.2.2:5000/api"
    : "http://localhost:5000/api";
};

export const BASE_URL = getBaseUrl();

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;
let refreshSubscribers = [];

const setRequestHeader = (headers, name, value) => {
  if (!headers) return;

  if (typeof headers.set === "function") {
    headers.set(name, value);
    return;
  }

  headers[name] = value;
};

const getRequestHeader = (headers, name) => {
  if (!headers) return undefined;

  if (typeof headers.get === "function") {
    return headers.get(name);
  }

  return headers[name] ?? headers[name.toLowerCase()];
};

const isEventUpdateRequest = (config = {}) =>
  String(config.method ?? "").toLowerCase() === "put" &&
  /^\/?Events\/[^/]+$/i.test(String(config.url ?? ""));

const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onRefreshed = (accessToken) => {
  const subscribers = refreshSubscribers;
  refreshSubscribers = [];
  subscribers.forEach((cb) => cb(accessToken));
};

const clearStoredAuthAndSignalSignOut = async () => {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.USER_TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
    AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
  ]);

  delete axiosInstance.defaults.headers.common.Authorization;

  try {
    globalThis.__CHECKPOINT_ON_SIGN_OUT__?.();
  } catch {}
};

axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.USER_TOKEN);

    if (token) {
      config.headers = config.headers || {};
      setRequestHeader(config.headers, "Authorization", `Bearer ${token}`);
    }

    if (__DEV__ && isEventUpdateRequest(config)) {
      const authHeader = getRequestHeader(config.headers, "Authorization");

      logger.debug("EVENT UPDATE AUTH HEADER:", {
        method: String(config.method ?? "").toUpperCase(),
        url: `${config.baseURL ?? BASE_URL}${config.url ?? ""}`,
        hasStoredToken: Boolean(token),
        storedTokenLength: token?.length ?? 0,
        hasAuthorizationHeader: Boolean(authHeader),
        authorizationScheme: authHeader
          ? String(authHeader).split(/\s+/)[0]
          : null,
      });
    }

    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === "object") {
      Object.defineProperty(response.data, "__httpStatus", {
        value: response.status,
        enumerable: false,
        configurable: true,
      });
    }

    return response.data;
  },

  async (error) => {
    const originalRequest = error.config;

    const isUnauthorized = error.response?.status === 401;
    const requestUrl = originalRequest?.url || "";
    const isRefreshCall =
      requestUrl.includes("/Auth/refresh") ||
      requestUrl.endsWith("/Auth/refresh");

    if (
      isUnauthorized &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshCall
    ) {
      originalRequest._retry = true;

      try {
        const retryOriginalRequest = (newAccessToken) => {
          originalRequest.headers = originalRequest.headers || {};
          setRequestHeader(
            originalRequest.headers,
            "Authorization",
            `Bearer ${newAccessToken}`,
          );
          return axiosInstance(originalRequest);
        };

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            subscribeTokenRefresh((newAccessToken) => {
              if (!newAccessToken) {
                reject(error);
                return;
              }
              resolve(retryOriginalRequest(newAccessToken));
            });
          });
        }

        isRefreshing = true;

        const refreshToken = await SecureStore.getItemAsync(
          STORAGE_KEYS.REFRESH_TOKEN,
        );
        if (!refreshToken) {
          throw new Error("No refresh token found");
        }

        const refreshResponse = await axios.post(`${BASE_URL}/Auth/refresh`, {
          refreshToken,
        });

        const payload =
          refreshResponse?.data?.data ?? refreshResponse?.data ?? {};
        const newAccessToken = payload.accessToken ?? payload.token;
        const newRefreshToken = payload.refreshToken;

        if (!newAccessToken || !newRefreshToken) {
          throw new Error("Invalid refresh response payload");
        }

        await SecureStore.setItemAsync(STORAGE_KEYS.USER_TOKEN, newAccessToken);
        await SecureStore.setItemAsync(
          STORAGE_KEYS.REFRESH_TOKEN,
          newRefreshToken,
        );

        axiosInstance.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;

        onRefreshed(newAccessToken);
        return retryOriginalRequest(newAccessToken);
      } catch (refreshError) {
        onRefreshed(null);
        await clearStoredAuthAndSignalSignOut();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (!error.response) {
      error.message = "Erreur réseau. Veuillez vérifier votre connexion.";
    }

    return Promise.reject({
      message:
        error.response?.data?.message ||
        error.message ||
        "Une erreur s'est produite",
      status: error.response?.status,
      data: error.response?.data,
      url: error?.config?.url,
      baseURL: error?.config?.baseURL,
    });
  },
);

axiosInstance.setAuthToken = async (token, refreshToken = null) => {
  if (token) {
    await SecureStore.setItemAsync(STORAGE_KEYS.USER_TOKEN, token);

    if (refreshToken) {
      await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }

    axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    delete axiosInstance.defaults.headers.common.Authorization;
  }
};

axiosInstance.clearAuthToken = async () => {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_TOKEN);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
  await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);

  delete axiosInstance.defaults.headers.common.Authorization;
};

export default axiosInstance;
