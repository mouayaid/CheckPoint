import React, { createContext, useContext, useMemo } from "react";
import { isE2EMode } from "../utils/e2eMode";

const E2eModeContext = createContext(false);

export function E2eModeProvider({ children }) {
  const enabled = useMemo(() => isE2EMode(), []);

  return (
    <E2eModeContext.Provider value={enabled}>{children}</E2eModeContext.Provider>
  );
}

export function useE2eMode() {
  return useContext(E2eModeContext);
}
