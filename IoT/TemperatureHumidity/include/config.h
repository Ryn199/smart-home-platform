#pragma once

// ============================================================
// SMART HOME PLATFORM - IOT NODE CONFIGURATION (DHT22)
// ============================================================

// 1. Default WiFi Network Credentials (Used when EEPROM is uninitialized)
#define WIFI_SSID       "Ryn-IoT"
#define WIFI_PASSWORD   "IoT11191205!"

// 2. Default MQTT Broker Configuration (Used when EEPROM is uninitialized)
#define MQTT_BROKER     "202.10.41.155"   // IP Address or Hostname of MQTT Broker
#define MQTT_PORT       1883
#define MQTT_USER       "mqttuser"        // Leave blank if no auth
#define MQTT_PASSWORD   "11191205"        // Leave blank if no auth

// 3. Hardware Authentication (Pairing Code)
// Matches the "Pairing Code" entered when registering the device in Web Admin.
// Note: Firmware version is now stored dynamically in EEPROM (default: "First Firmware").
#define PAIRING_CODE        "awsrgwegfq4GQEGQ290468TYH"

// 4. Hardware Pinout & Sensor Type
#if defined(ESP8266)
  #define DHTPIN              12   // GPI12 (Pin D6 on NodeMCU / Pin IO2 on ESP-01)
  #define TRIGGER_PIN         0   // GPIO0 (Pin D3 / Flash Button on NodeMCU) -> Connect to GND to trigger config portal
  #define LED_INDICATOR_PIN  14   // GPIO14 (Pin D5 on NodeMCU) -> External LED (NOT built-in LED)
#elif defined(ESP32)
  #define DHTPIN              4   // GPIO4 on ESP32
  #define TRIGGER_PIN         0   // GPIO0 (BOOT button on ESP32) -> Connect to GND to trigger config portal
  #define LED_INDICATOR_PIN  18   // GPIO18 on ESP32 -> External LED (NOT built-in LED)
#endif

#define DHTTYPE         DHT11     // DHT22 (AM2302 / AM2321)

// 5. Telemetry Transmission Interval
// NOTE: DHT11 hardware has a max sampling rate of 1 Hz (1 reading per second).
// A minimum interval of 2000ms (2 seconds) is strongly recommended for stable readings.
#define TELEMETRY_INTERVAL_MS 2000
