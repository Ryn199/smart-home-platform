#pragma once

#include <Arduino.h>

struct AppConfig {
  char magic[5];            // "SH04" for integrity check
  char wifiSsid[33];        // WiFi SSID (max 32 chars)
  char wifiPassword[65];    // WiFi Password (max 64 chars)
  char mqttBroker[65];      // MQTT Broker host/IP (max 64 chars)
  uint16_t mqttPort;        // MQTT Broker port
  char mqttUser[33];        // MQTT Username (max 32 chars)
  char mqttPassword[33];    // MQTT Password (max 32 chars)
  char pairingCode[65];     // Device Pairing Code (max 64 chars)
  char firmwareVersion[33]; // Dynamic Firmware Version name (e.g. "First Firmware", "v1.0.1")
  uint8_t lastPosition;     // Saved curtain position (0-100)
};

/**
 * @brief Initialize EEPROM storage and load stored configuration
 */
void initStorage();

/**
 * @brief Get active configuration from storage
 * @return const AppConfig& reference to current configuration
 */
const AppConfig& getConfig();

/**
 * @brief Get current dynamic firmware version string from storage
 */
const char* getFirmwareVersion();

/**
 * @brief Save dynamic firmware version to EEPROM (updated upon OTA update)
 * @param newVersion New firmware version string (e.g. "1.0.1")
 * @return true if successfully saved
 */
bool saveFirmwareVersion(const char* newVersion);

/**
 * @brief Save new configuration to EEPROM
 * @param newConfig AppConfig structure with updated values
 * @return true if successfully written and committed to EEPROM
 */
bool saveConfig(const AppConfig& newConfig);

/**
 * @brief Save last known curtain position to EEPROM
 * @param position Position percentage (0-100)
 * @return true if successfully saved
 */
bool saveCurtainPosition(uint8_t position);

/**
 * @brief Reset stored configuration to default values
 */
void resetConfig();
