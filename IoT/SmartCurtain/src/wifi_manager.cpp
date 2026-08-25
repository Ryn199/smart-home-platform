#include "wifi_manager.h"
#include "storage_manager.h"

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
#elif defined(ESP32)
  #include <WiFi.h>
#endif

static String deviceMac = "";

void setupWiFi() {
  delay(10);
  const AppConfig& config = getConfig();

  Serial.println();
  Serial.println("==================================================");
  Serial.println("Smart Home IoT Node - Smart Curtain");
  Serial.println("==================================================");

  // Retrieve hardware MAC Address from WiFi chip
  deviceMac = WiFi.macAddress();
  Serial.print("[WiFi] Device Hardware MAC: ");
  Serial.println(deviceMac);
  Serial.print("[Auth] Configured Pairing Code: ");
  Serial.println(config.pairingCode);

  Serial.print("[WiFi] Connecting to SSID: ");
  Serial.println(config.wifiSsid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(config.wifiSsid, config.wifiPassword);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[WiFi] WiFi connected successfully!");
    Serial.print("[WiFi] Assigned IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("[WiFi] Warning: Could not connect to WiFi. Will retry in main loop (or press Trigger button for Web Config)...");
  }
}

String getDeviceMac() {
  if (deviceMac.length() == 0) {
    deviceMac = WiFi.macAddress();
  }
  return deviceMac;
}

bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

void reconnectWiFi() {
  WiFi.reconnect();
}
