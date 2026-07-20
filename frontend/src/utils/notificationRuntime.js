import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export const CHECKPOINT_NOTIFICATION_CHANNEL_ID = "default";

let notificationHandlerConfigured = false;
let androidChannelPromise = null;

export const configureForegroundNotificationHandler = () => {
  if (notificationHandlerConfigured) return;

  notificationHandlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
};

export const ensureAndroidNotificationChannel = () => {
  if (Platform.OS !== "android") return Promise.resolve();

  if (!androidChannelPromise) {
    androidChannelPromise = Notifications.setNotificationChannelAsync(
      CHECKPOINT_NOTIFICATION_CHANNEL_ID,
      {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
      },
    );
  }

  return androidChannelPromise;
};
