/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: "jest",
      config: "e2e/jest.config.js",
    },
    jest: {
      setupTimeout: 120000,
      teardownTimeout: 120000,
    },
  },
  behavior: {
    init: {
      reinstallApp: false,
      exposeGlobals: true,
    },
  },
  apps: {
    "android.release": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/release/app-release.apk",
      testBinaryPath:
        "android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk",
      launchArgs: {
        e2e: true,
      },
      build:
        "cd android && set NODE_ENV=production&& gradlew.bat assembleRelease assembleReleaseAndroidTest -PdetoxBuild=true",
    },
  },
  devices: {
    emulator: {
      type: "android.emulator",
      device: {
        avdName: process.env.DETOX_AVD_NAME || "Pixel_9_Pro",
      },
    },
  },
  configurations: {
    "android.emu.debug": {
      device: "emulator",
      app: "android.release",
    },
  },
};

