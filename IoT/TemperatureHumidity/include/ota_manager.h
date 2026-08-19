#pragma once

#include <Arduino.h>

/**
 * @brief Initialize OTA manager hardware indicators
 */
void initOTAManager();

/**
 * @brief Download and flash new firmware (.bin) via HTTP Over-The-Air (OTA)
 * 
 * Supports independent Backend HTTP API host / URL completely separated from MQTT Broker.
 * 
 * @param url Full HTTP URL to the firmware binary endpoint on backend (e.g. http://192.168.1.50:3000/api/firmware/1/download)
 * @param version Target firmware version string for verification & logging (e.g. "1.0.1")
 * @param checksum Expected SHA-256 or MD5 checksum (optional)
 * @param expectedSize Expected binary size in bytes (optional)
 * @return true if update succeeded (ESP will reboot automatically)
 * @return false if update failed
 */
bool startFirmwareOTA(const char* url, const char* version = "", const char* checksum = "", size_t expectedSize = 0);
