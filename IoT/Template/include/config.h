#pragma once

// ============================================================
// SMART HOME PLATFORM - BASE IOT NODE CONFIGURATION TEMPLATE
// ============================================================

// 1. Default WiFi Network Credentials (Used when EEPROM is uninitialized)
#define WIFI_SSID       "Ryn-IoT"
#define WIFI_PASSWORD   "IoT11191205!"

// 2. Default MQTT Broker Configuration (Used when EEPROM is uninitialized)
#define MQTT_BROKER     "202.10.41.155"   // IP Address or Hostname of MQTT Broker
#define MQTT_PORT       1883
#define MQTT_USER       "smarthome"        // Leave blank if no auth
#define MQTT_PASSWORD   "11191205"        // Leave blank if no auth

// 3. Hardware Authentication (Pairing Code)
// Matches the "Pairing Code" entered when registering the device in Web Admin.
#define PAIRING_CODE    "awsrgwegfq4GQEGQ290468TYH"

// 4. Hardware Pinout
#if defined(ESP8266)
  #define TRIGGER_PIN         0   // GPIO0 (Pin D3 / Flash Button on NodeMCU) -> Connect to GND to trigger config portal
  #define LED_INDICATOR_PIN  14   // GPIO14 (Pin D5 on NodeMCU) -> External LED indicator
#elif defined(ESP32)
  #define TRIGGER_PIN         0   // GPIO0 (BOOT button on ESP32) -> Connect to GND to trigger config portal
  #define LED_INDICATOR_PIN  18   // GPIO18 on ESP32 -> External LED indicator
#endif

// 5. Diagnostics Interval
#define DIAGNOSTICS_INTERVAL_MS 60000 // Send system diagnostics every 60 seconds
