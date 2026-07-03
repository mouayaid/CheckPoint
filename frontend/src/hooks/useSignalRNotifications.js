import logger from "../utils/logger";
import { useEffect, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "../utils/constants";
import { BASE_URL } from "../services/api/axiosInstance";

export const useSignalRNotifications = (onNotificationReceived, enabled = true) => {
  const connectionRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    let isMounted = true;
    let activeConnection = null;

    const connect = async () => {
      const getAccessToken = () => SecureStore.getItemAsync(STORAGE_KEYS.USER_TOKEN);
      const token = await getAccessToken();

      if (!token || !BASE_URL) return;

      const hubUrl = BASE_URL.replace("/api", "/hubs/notifications");

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: getAccessToken,
        })
        .withAutomaticReconnect()
        .build();

      activeConnection = connection;
      connectionRef.current = connection;

      const handleReceiveNotification = (notification) => {
        if (onNotificationReceived) {
          onNotificationReceived(notification);
        }
      };

      connection.off("ReceiveNotification");
      connection.on("ReceiveNotification", handleReceiveNotification);

      try {
        await connection.start();

        if (!isMounted) {
          connection.off("ReceiveNotification", handleReceiveNotification);
          await connection.stop();
          return;
        }

        logger.debug("SignalR notifications connected");
      } catch (error) {
        logger.debug("SignalR connection error:", error);
      }
    };

    connect();

    return () => {
      isMounted = false;

      const connection = activeConnection || connectionRef.current;

      if (connection) {
        connection.off("ReceiveNotification");
        connection.stop();
      }

      if (connectionRef.current === connection) {
        connectionRef.current = null;
      }
    };
  }, [enabled, onNotificationReceived]);
};
