import React, { createContext, useContext, useState } from "react";
import { colors as lightColors } from "../theme/theme";

const darkColors = {
  ...lightColors,
  background: "#0F172A",
  surface: "#1E293B",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5F5",
  border: "#334155",
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  const theme = {
    colors: darkMode ? darkColors : lightColors,
    darkMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);