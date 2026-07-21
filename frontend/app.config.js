const apiHost = process.env.EXPO_PUBLIC_API_HOST || null;

const apiUrls = {
  development: apiHost ? `http://${apiHost}:5000/api` : null,
  staging: process.env.EXPO_PUBLIC_STAGING_API_URL,

  production: process.env.EXPO_PUBLIC_PRODUCTION_API_URL,
};

const getEnvironment = () => {
  const profile = process.env.EAS_BUILD_PROFILE || "development";

  if (profile === "staging" || profile === "production") {
    return profile;
  }

  return "development";
};

const environment = getEnvironment();

if (environment !== "development" && !apiUrls[environment]) {
  throw new Error(
    `Missing API URL for "${environment}". Set the corresponding EXPO_PUBLIC_*_API_URL environment variable.`,
  );
}

module.exports = {
  expo: {
    name: "CheckPoint",
    slug: "pfe-mobile-app",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],

    ios: {
      supportsTablet: true,
    },

    web: {
      favicon: "./assets/favicon.png",
    },

    plugins: [
      "expo-font",
      "@react-native-community/datetimepicker",
      [
        "expo-media-library",
        {
          photosPermission:
            "Autoriser l'acc\u00e8s \u00e0 la galerie pour enregistrer les QR codes.",
          savePhotosPermission:
            "Autoriser l'application \u00e0 enregistrer les QR codes dans la galerie.",
          isAccessMediaLocationEnabled: false,
        },
      ],
      "expo-notifications",
      "expo-audio",
      "expo-asset",
    ],

    android: {
      package: "com.anonymous.pfemobileapp",
      googleServicesFile: "./google-services.json",
      permissions: [
        "READ_MEDIA_IMAGES",
        "WRITE_EXTERNAL_STORAGE",
        "POST_NOTIFICATIONS",
      ],
      softwareKeyboardLayoutMode: "resize",
    },

    extra: {
      apiHost,
      apiUrl: apiUrls[environment],
      environment,
      eas: {
        projectId: "54c65ff2-cd14-4902-8a88-1209ffff4d82",
      },
    },
  },
};
