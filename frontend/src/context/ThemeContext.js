import React, { createContext, useContext, useMemo, useState } from "react";
import {
  lightColors,
  darkColors,
  spacing,
  borderRadius,
  typography,
  shadows,
} from "../theme/theme";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  const theme = useMemo(() => {
    const activeColors = darkMode ? darkColors : lightColors;

    return {
      colors: activeColors,
      spacing,
      borderRadius,
      typography,
      shadows,
      darkMode,
      toggleTheme,
    };
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);