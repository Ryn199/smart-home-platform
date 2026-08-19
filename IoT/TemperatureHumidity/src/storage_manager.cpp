#include "storage_manager.h"
#include "config.h"
#include <EEPROM.h>

#define CONFIG_MAGIC "SH04"
#define EEPROM_SIZE sizeof(AppConfig)

static AppConfig currentConfig;

static void loadDefaults() {
  memset(&currentConfig, 0, sizeof(AppConfig));
  memcpy(currentConfig.magic, CONFIG_MAGIC, sizeof(currentConfig.magic));
  strncpy(currentConfig.wifiSsid, WIFI_SSID, sizeof(currentConfig.wifiSsid) - 1);
  strncpy(currentConfig.wifiPassword, WIFI_PASSWORD, sizeof(currentConfig.wifiPassword) - 1);
  strncpy(currentConfig.mqttBroker, MQTT_BROKER, sizeof(currentConfig.mqttBroker) - 1);
  currentConfig.mqttPort = MQTT_PORT;
  strncpy(currentConfig.mqttUser, MQTT_USER, sizeof(currentConfig.mqttUser) - 1);
  strncpy(currentConfig.mqttPassword, MQTT_PASSWORD, sizeof(currentConfig.mqttPassword) - 1);
  strncpy(currentConfig.pairingCode, PAIRING_CODE, sizeof(currentConfig.pairingCode) - 1);
  strncpy(currentConfig.firmwareVersion, "First Firmware", sizeof(currentConfig.firmwareVersion) - 1);
}

void initStorage() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(0, currentConfig);

  // Validate stored data with magic key
  if (strncmp(currentConfig.magic, CONFIG_MAGIC, 4) != 0) {
    Serial.println("[Storage] Uninitialized/updated EEPROM detected. Initializing with default config.h settings...");
    loadDefaults();
    EEPROM.put(0, currentConfig);
    EEPROM.commit();
  } else {
    Serial.println("[Storage] Configuration successfully loaded from EEPROM:");
    Serial.print("          WiFi SSID       : "); Serial.println(currentConfig.wifiSsid);
    Serial.print("          MQTT Broker     : "); Serial.print(currentConfig.mqttBroker);
    Serial.print(":"); Serial.println(currentConfig.mqttPort);
    Serial.print("          Pairing Code    : "); Serial.println(currentConfig.pairingCode);
    Serial.print("          Firmware Version: "); Serial.println(currentConfig.firmwareVersion);
  }
}

const AppConfig& getConfig() {
  return currentConfig;
}

const char* getFirmwareVersion() {
  if (strlen(currentConfig.firmwareVersion) == 0) {
    return "First Firmware";
  }
  return currentConfig.firmwareVersion;
}

bool saveFirmwareVersion(const char* newVersion) {
  if (!newVersion || strlen(newVersion) == 0) return false;
  strncpy(currentConfig.firmwareVersion, newVersion, sizeof(currentConfig.firmwareVersion) - 1);
  currentConfig.firmwareVersion[sizeof(currentConfig.firmwareVersion) - 1] = '\0';
  EEPROM.put(0, currentConfig);
  bool success = EEPROM.commit();
  if (success) {
    Serial.printf("[Storage] Dynamic firmware version updated to '%s' in EEPROM.\n", currentConfig.firmwareVersion);
  } else {
    Serial.println("[Storage] Error: Failed to save dynamic firmware version to EEPROM!");
  }
  return success;
}

bool saveConfig(const AppConfig& newConfig) {
  currentConfig = newConfig;
  memcpy(currentConfig.magic, CONFIG_MAGIC, sizeof(currentConfig.magic));
  EEPROM.put(0, currentConfig);
  bool success = EEPROM.commit();
  if (success) {
    Serial.println("[Storage] New configuration saved to EEPROM.");
  } else {
    Serial.println("[Storage] Error: Failed to commit EEPROM!");
  }
  return success;
}

void resetConfig() {
  loadDefaults();
  EEPROM.put(0, currentConfig);
  EEPROM.commit();
  Serial.println("[Storage] EEPROM reset to defaults.");
}
