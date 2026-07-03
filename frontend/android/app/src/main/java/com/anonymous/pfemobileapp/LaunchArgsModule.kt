package com.anonymous.pfemobileapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class LaunchArgsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "LaunchArgsModule"

  override fun getConstants(): Map<String, Any?> =
    LaunchArgsHolder.getArgs() + mapOf("e2eBuild" to BuildConfig.IS_DETOX_BUILD)
}
