import React, { createContext, useContext, useState, useCallback } from "react";
import { departmentChannelService } from "../services/api/departmentChannelService";
const DepartmentChannelContext = createContext();

export const DepartmentChannelProvider = ({ children }) => {
  const [channelUnreadCount, setChannelUnreadCount] = useState(0);
  const [channelInfo, setChannelInfo] = useState(null);

  const refreshChannelInfo = useCallback(async () => {
    try {
      const res = await departmentChannelService.getMyChannel();
      const payload = res?.data?.data ?? res?.data ?? null;

      setChannelUnreadCount(payload?.unreadCount ?? 0);
      setChannelInfo(payload);
    } catch (error) {
      console.log("Failed to load department channel info:", error);
      setChannelUnreadCount(0);
      setChannelInfo(null);
    }
  }, []);

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
