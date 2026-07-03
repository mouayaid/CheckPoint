import { NativeModules, Platform } from "react-native";

let cachedE2E = null;

function parseE2EValue(value) {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function readLaunchArgs() {
  if (Platform.OS === "android") {
    const extras = NativeModules?.LaunchArgsModule?.getConstants?.();
    if (extras && typeof extras === "object") return extras;
  }

  return {};
}

export function isE2EMode() {
  if (cachedE2E !== null) return cachedE2E;
  const args = readLaunchArgs();
  cachedE2E = parseE2EValue(args.e2e) || parseE2EValue(args.e2eBuild);
  return cachedE2E;
}

export function resetE2EModeCache() {
  cachedE2E = null;
}
