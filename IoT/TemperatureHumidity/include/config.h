#pragma once

// ============================================================
// SMART HOME PLATFORM - IOT NODE CONFIGURATION (DHT22)
// ============================================================

// 1. WiFi Network Credentials
#define WIFI_SSID       "Wokwi-GUEST"
#define WIFI_PASSWORD   ""

// 2. MQTT Broker Configuration
#define MQTT_BROKER     "202.10.41.155"   // IP Address or Hostname of MQTT Broker
#define MQTT_PORT       1883
#define MQTT_USER       "mqttuser"                // Leave blank if no auth
#define MQTT_PASSWORD   "11191205"                // Leave blank if no auth

// 3. Hardware Authentication (Pairing Code)
// Matches the "Pairing Code" entered when registering the device in Web Admin.
// No deviceUid, homeId, or roomId needed in firmware.
#define PAIRING_CODE    "TH-7788"

// 4. Hardware Pinout & Sensor Type (DHT22)
#if defined(ESP8266)
  #define DHTPIN        2                 // GPIO2 (Pin D4 on NodeMCU / Pin IO2 on ESP-01)
#elif defined(ESP32)
  #define DHTPIN        4                 // GPIO4 on ESP32
#endif

#define DHTTYPE         DHT22             // DHT22 (AM2302 / AM2321)

// 5. Telemetry Transmission Interval
#define TELEMETRY_INTERVAL_MS 1000        // Send reading every 5 seconds
