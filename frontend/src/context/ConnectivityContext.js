import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import NetInfo from "@react-native-community/netinfo";

const ConnectivityContext = createContext();

export const ConnectivityProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected);
    });

    return unsubscribe;
  }, []);

  return (
    <ConnectivityContext.Provider value={{ isConnected }}>
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = () => {
  return useContext(ConnectivityContext);
};