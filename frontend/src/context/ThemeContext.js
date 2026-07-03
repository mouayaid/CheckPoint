import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadThemePreference = async () => {
      try {
        const saved = await AsyncStorage.getItem("checkpoint_theme");
        if (!cancelled && saved === "dark") {
          setDarkMode(true);
        }
      } catch (e) {
        // ignore: fall back to default theme
      } finally {
        if (!cancelled) setThemeLoaded(true);
      }
    };

    loadThemePreference();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const next = !prev;
      AsyncStorage.setItem("checkpoint_theme", next ? "dark" : "light").catch(
        () => {},
      );
      return next;
    });
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
      themeLoaded,
      toggleTheme,
    };
  }, [darkMode, themeLoaded]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);