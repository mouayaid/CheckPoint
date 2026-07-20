import logger from "../utils/logger";
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "../utils/constants";
import { ensureAndroidNotificationChannel } from "../utils/notificationRuntime";
import { axiosInstance, notificationService } from "../services/api";

const AuthContext = createContext();

const getExpoProjectId = () =>
  Constants.easConfig?.projectId ??
  Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.manifest?.extra?.eas?.projectId;

const getRegisteredPushTokenStorageKey = (userId) =>
  `${STORAGE_KEYS.REGISTERED_EXPO_PUSH_TOKEN_BY_USER}:${userId}`;

const maskPushToken = (token) => {
  if (!token || typeof token !== "string") return null;
  if (token.length <= 18) return "***";
  return `${token.slice(0, 16)}...${token.slice(-8)}`;
};

const sanitizePushRegistrationError = (error) => ({
  message: error?.message,
  status: error?.status,
  responseMessage: error?.data?.message,
  responseErrors: Array.isArray(error?.data?.errors)
    ? error.data.errors.slice(0, 3)
    : undefined,
  url: error?.url,
  baseURL: error?.baseURL,
});

const logPushDebug = (message, details) => {
  if (!__DEV__) return;

  if (details === undefined) {
    logger.debug(`[push-token] ${message}`);
    return;
  }

  logger.debug(`[push-token] ${message}`, details);
};

const registerExpoPushToken = async (currentUser) => {
  const userId = currentUser?.id ?? currentUser?.Id;

  if (Platform.OS === "web") {
    logPushDebug("skipped because platform does not support native push", {
      platform: Platform.OS,
    });
    return false;
  }

  if (!userId) {
    logPushDebug("skipped because authenticated user is not loaded", {
      hasUser: Boolean(currentUser),
    });
    return false;
  }

  logPushDebug("registration start", {
    platform: Platform.OS,
    isDevice: Constants.isDevice,
    userId: String(userId),
  });

  if (!Constants.isDevice) {
    logPushDebug("skipped because push tokens require a physical device", {
      isDevice: Constants.isDevice,
    });
    return false;
  }

  if (Platform.OS === "android") {
    logPushDebug("creating Android notification channel", {
      channelId: "default",
      importance: "MAX",
    });
    await ensureAndroidNotificationChannel();
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  let finalStatus = currentPermission.status;
  logPushDebug("permission response", {
    phase: "current",
    status: currentPermission.status,
    canAskAgain: currentPermission.canAskAgain,
    granted: currentPermission.granted,
  });
  logPushDebug("permission canAskAgain", {
    phase: "current",
    canAskAgain: currentPermission.canAskAgain,
  });

  if (finalStatus !== "granted") {
    if (currentPermission.canAskAgain === false) {
      logPushDebug("skipped because notification permission cannot be requested again", {
        status: currentPermission.status,
        canAskAgain: currentPermission.canAskAgain,
        action: "open Android app notification settings",
      });
      return false;
    }

    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
    logPushDebug("permission response", {
      phase: "requested",
      status: requestedPermission.status,
      canAskAgain: requestedPermission.canAskAgain,
      granted: requestedPermission.granted,
    });
    logPushDebug("permission canAskAgain", {
      phase: "requested",
      canAskAgain: requestedPermission.canAskAgain,
    });
  }

  if (finalStatus !== "granted") {
    logPushDebug("skipped because notification permission was not granted", {
      finalStatus,
    });
    return false;
  }

  const projectId = getExpoProjectId();
  logPushDebug("EAS project id lookup", {
    hasProjectId: Boolean(projectId),
  });

  if (!projectId) {
    throw new Error("Missing EAS projectId for Expo push token registration.");
  }

  const nativeTokenResponse = await Notifications.getDevicePushTokenAsync();
  logPushDebug("native device push token result", {
    hasNativeToken: Boolean(nativeTokenResponse?.data),
    nativeTokenType: nativeTokenResponse?.type,
  });

  if (!nativeTokenResponse?.data) {
    throw new Error("Native device push token was not generated.");
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse?.data;
  logPushDebug("Expo push token result", {
    hasExpoToken: Boolean(expoPushToken),
    token: maskPushToken(expoPushToken),
  });

  if (!expoPushToken) {
    logger.warn("[push-token] Expo token missing from response.");
    return false;
  }

  const storageKey = getRegisteredPushTokenStorageKey(userId);
  const previouslyRegisteredToken = await AsyncStorage.getItem(storageKey);

  if (previouslyRegisteredToken === expoPushToken) {
    logPushDebug("registration already considered completed because token is unchanged", {
      userId: String(userId),
    });
    return true;
  }

  logPushDebug("API registration attempt");
  try {
    const response = await notificationService.registerExpoPushToken(
      expoPushToken,
    );

    logPushDebug("API registration result", {
      success: response?.success,
      message: response?.message,
      status: response?.__httpStatus,
    });

    if (response?.success === false) {
      throw new Error(response?.message || "Expo push token API registration failed.");
    }

    await AsyncStorage.setItem(storageKey, expoPushToken);
    return true;
  } catch (error) {
    logger.warn(
      "[push-token] API registration failed:",
      sanitizePushRegistrationError(error),
    );
    throw error;
  }
};

const clearRegisteredExpoPushTokenState = async (currentUser) => {
  const userId = currentUser?.id ?? currentUser?.Id;
  if (!userId) return;

  await AsyncStorage.removeItem(getRegisteredPushTokenStorageKey(userId));
  logPushDebug("cleared local registered token state", {
    userId: String(userId),
  });
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const isAuthenticatedRef = useRef(false);
  const pushRegistrationCompletedRef = useRef(null);
  const pushRegistrationInFlightRef = useRef(null);

  const [refreshFlag, setRefreshFlag] = useState(0);

  const triggerRefresh = () => {
    setRefreshFlag((prev) => prev + 1);
  };

  useEffect(() => {
    loadStoredAuth();
  }, []);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    const userId = user?.id ?? user?.Id;

    if (isLoading) {
      logPushDebug("registration skipped because user is still loading", {
        isLoading,
        isAuthenticated,
        hasUser: Boolean(user),
      });
      return;
    }

    if (!isAuthenticated) {
      logPushDebug("registration skipped because there is no authenticated user", {
        isAuthenticated,
        hasUser: Boolean(user),
      });
      pushRegistrationCompletedRef.current = null;
      pushRegistrationInFlightRef.current = null;
      return;
    }

    if (!userId) {
      logPushDebug("registration skipped because current user is not loaded", {
        isAuthenticated,
        hasUser: Boolean(user),
      });
      return;
    }

    const registrationKey = String(userId);
    if (pushRegistrationCompletedRef.current === registrationKey) {
      logPushDebug("registration skipped because it is already considered completed", {
        userId: registrationKey,
      });
      return;
    }

    if (pushRegistrationInFlightRef.current === registrationKey) {
      logPushDebug("registration skipped because an attempt is already in progress", {
        userId: registrationKey,
      });
      return;
    }

    pushRegistrationInFlightRef.current = registrationKey;

    registerExpoPushToken(user)
      .then((registrationSucceeded) => {
        if (registrationSucceeded) {
          pushRegistrationCompletedRef.current = registrationKey;
          logPushDebug("registration completed", {
            userId: registrationKey,
          });
        }
      })
      .catch((error) => {
        logger.warn(
          "Expo push token registration failed:",
          sanitizePushRegistrationError(error),
        );
        logPushDebug("registration failed with exception", {
          userId: registrationKey,
          error: sanitizePushRegistrationError(error),
        });
      })
      .finally(() => {
        if (pushRegistrationInFlightRef.current === registrationKey) {
          pushRegistrationInFlightRef.current = null;
        }
      });
  }, [isAuthenticated, isLoading, refreshFlag, user]);

  const resetAuthState = useCallback(() => {
    const wasAuthenticated = isAuthenticatedRef.current;

    setUser(null);
    setIsAuthenticated(false);
    setIsLoading(false);
    isAuthenticatedRef.current = false;

    if (wasAuthenticated) {
      triggerRefresh();
    }
  }, []);

  useEffect(() => {
    globalThis.__CHECKPOINT_ON_SIGN_OUT__ = resetAuthState;

    return () => {
      if (globalThis.__CHECKPOINT_ON_SIGN_OUT__ === resetAuthState) {
        delete globalThis.__CHECKPOINT_ON_SIGN_OUT__;
      }
    };
  }, [resetAuthState]);

  const loadStoredAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.USER_TOKEN);
      const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);

      if (token && userData) {
        await axiosInstance.setAuthToken(token, refreshToken);
        setUser(JSON.parse(userData));
        setIsAuthenticated(true);
        isAuthenticatedRef.current = true;
      }
    } catch (error) {
      logger.error("Error loading stored auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (token, refreshToken, userData) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.USER_TOKEN, token);

      if (refreshToken) {
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_DATA,
        JSON.stringify(userData)
      );

      await axiosInstance.setAuthToken(token, refreshToken);

      setUser(userData);
      setIsAuthenticated(true);
      isAuthenticatedRef.current = true;
      triggerRefresh();
    } catch (error) {
      logger.error("Error signing in:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const signedInUser = user;

      try {
        await notificationService.clearExpoPushToken();
      } catch (error) {
        logger.warn("Expo push token clear failed:", error);
      }

      await clearRegisteredExpoPushTokenState(signedInUser);

      await axiosInstance.clearAuthToken();

      resetAuthState();
    } catch (error) {
      logger.error("Error signing out:", error);
      throw error;
    }
  };

  const updateUser = async (nextUser) => {
    if (!nextUser) return;

    setUser(nextUser);
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(nextUser));
    triggerRefresh();
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    signIn,
    signOut,
    updateUser,
    refreshFlag,
    triggerRefresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
