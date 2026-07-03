package com.anonymous.pfemobileapp

import android.content.Intent
import android.os.Bundle

object LaunchArgsHolder {
  @Volatile
  private var args: Map<String, Any?> = emptyMap()

  fun setFromIntent(intent: Intent?) {
    val extras = intent?.extras ?: return
    val result = mutableMapOf<String, Any?>()

    for (key in extras.keySet()) {
      when (val value = extras.get(key)) {
        is Boolean -> result[key] = value
        is Int -> result[key] = value
        is Long -> result[key] = value
        is Double -> result[key] = value
        is Float -> result[key] = value.toDouble()
        is String -> result[key] = value
        else -> if (value != null) result[key] = value.toString()
      }
    }

    args = result
  }

  fun getArgs(): Map<String, Any?> = args
}
