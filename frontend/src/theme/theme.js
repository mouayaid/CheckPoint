/**
 * Design system: colors, typography, spacing, radii, shadows.
 * Use these tokens across screens for a consistent, polished UI.
 */

export const lightColors = {
  // Brand
  primary: "#E11D48",
  primaryDark: "#BE123C",
  primaryLight: "#FDA4AF",

  // Base
  white: "#FFFFFF",
  black: "#000000",

  // Neutral surfaces
  background: "#F4F6F8",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#F9FAFB",
  inputBackground: "#FFFFFF",
  card: "#FFFFFF",
  overlay: "rgba(0, 0, 0, 0.35)",

  // Text
  text: "#1A1D26",
  textPrimary: "#1A1D26",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  textMuted: "#9CA3AF",
  textOnPrimary: "#FFFFFF",
  placeholder: "#9CA3AF",

  // Semantic
  success: "#10B981",
  successLight: "#D1FAE5",
  error: "#EF4444",
  errorLight: "#FEE2E2",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  info: "#3B82F6",
  infoLight: "#DBEAFE",

  // Seat map
  seatAvailable: "#10B981",
  seatReserved: "#EF4444",
  seatSelected: "#E53935",
  seatMine: "#3B82F6",

  // Borders
  border: "#E5E7EB",
  borderLight: "#F3F4F6",

  // Tab bar
  tabActive: "#E53935",
  tabInactive: "#9CA3AF",

  // Auth / decorative
  authBackgroundTop: "#FFF5F5",
  authBackgroundBottom: "#FDECEC",

  // Shadow helpers
  shadow: "#000000",
};

export const darkColors = {
  // Brand
  primary: "#FB7185",
  primaryDark: "#E11D48",
  primaryLight: "#FDA4AF",

  // Base
  white: "#FFFFFF",
  black: "#000000",

  // Neutral surfaces
  background: "#0F172A",
  surface: "#1E293B",
  surfaceElevated: "#273449",
  surfaceMuted: "#334155",
  inputBackground: "#1E293B",
  card: "#1E293B",
  overlay: "rgba(0, 0, 0, 0.45)",

  // Text
  text: "#F8FAFC",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textTertiary: "#94A3B8",
  textMuted: "#94A3B8",
  textOnPrimary: "#FFFFFF",
  placeholder: "#94A3B8",

  // Semantic
  success: "#34D399",
  successLight: "rgba(16, 185, 129, 0.18)",
  error: "#F87171",
  errorLight: "rgba(239, 68, 68, 0.18)",
  warning: "#FBBF24",
  warningLight: "rgba(245, 158, 11, 0.18)",
  info: "#60A5FA",
  infoLight: "rgba(59, 130, 246, 0.18)",

  // Seat map
  seatAvailable: "#34D399",
  seatReserved: "#F87171",
  seatSelected: "#FF5A57",
  seatMine: "#60A5FA",

  // Borders
  border: "#334155",
  borderLight: "#475569",

  // Tab bar
  tabActive: "#FF5A57",
  tabInactive: "#94A3B8",

  // Auth / decorative
  authBackgroundTop: "#0F172A",
  authBackgroundBottom: "#1E293B",

  // Shadow helpers
  shadow: "#000000",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const typography = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 32,

  fontFamily: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },

  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
};

export default {
  lightColors,
  darkColors,
  spacing,
  borderRadius,
  typography,
  shadows,
};