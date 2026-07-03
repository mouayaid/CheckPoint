import logger from "../utils/logger";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { departmentChannelService } from "../services/api/departmentChannelService";
import { useAuth } from "./AuthContext";
const DepartmentChannelContext = createContext();

export const DepartmentChannelProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [channelUnreadCount, setChannelUnreadCount] = useState(0);
  const [channelInfo, setChannelInfo] = useState(null);

  const refreshChannelInfo = useCallback(async () => {
    try {
      const res = await departmentChannelService.getMyChannel();
      const payload = res?.data?.data ?? res?.data ?? res ?? null;

      setChannelUnreadCount(payload?.unreadCount ?? 0);
      setChannelInfo(payload);
    } catch (error) {
      logger.debug("Failed to load department channel info:", error);
      setChannelUnreadCount(0);
      setChannelInfo(null);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setChannelUnreadCount(0);
      setChannelInfo(null);
      return undefined;
    }

    refreshChannelInfo();
    const intervalId = setInterval(refreshChannelInfo, 30000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, refreshChannelInfo]);

  return (
    <DepartmentChannelContext.Provider
      value={{
        channelUnreadCount,
        channelInfo,
        refreshChannelInfo,
      }}
    >
      {children}
    </DepartmentChannelContext.Provider>
  );
};

export const useDepartmentChannel = () => {
  const context = useContext(DepartmentChannelContext);

  if (!context) {
    throw new Error(
      "useDepartmentChannel must be used within DepartmentChannelProvider",
    );
  }

  return context;
};
