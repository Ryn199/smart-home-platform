#pragma once

// ============================================================
// SMART HOME PLATFORM - IOT NODE CONFIGURATION (DHT22)
// ============================================================

// 1. WiFi Credentials
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// 2. MQTT Broker Configuration
#define MQTT_BROKER     "192.168.1.100"   // IP Address or Hostname of MQTT Broker
#define MQTT_PORT       1883
#define MQTT_USER       ""                // Leave blank if no auth
#define MQTT_PASSWORD   ""                // Leave blank if no auth

// 3. Device Identification & Security
#define HOME_ID         "1"               // ID of the Home in database
#define ROOM_ID         "1"               // ID of the Room in database
#define DEVICE_UID      "th-001"          // Unique UID registered in Admin Panel
#define PAIRING_CODE    "TH-7788"         // Secret pairing token (matches Admin Panel)

// 4. Hardware Pinout & Sensor Type
#if defined(ESP8266)
  #define DHTPIN        2                 // GPIO2 (Pin D4 on NodeMCU / Pin IO2 on ESP-01)
#elif defined(ESP32)
  #define DHTPIN        4                 // GPIO4 on ESP32
#endif

#define DHTTYPE         DHT22             // DHT22 (AM2302 / AM2321)

// 5. Telemetry Transmission Interval
#define TELEMETRY_INTERVAL_MS 5000        // Send reading every 5 seconds
