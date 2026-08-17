#include "wifi_service.h"

WiFiService wifiService;

WiFiService::WiFiService()
  : _macAddress(""),
    _lastReconnectAttempt(0) {
}

void WiFiService::begin() {
  delay(10);
  Serial.println();
  Serial.println("==================================================");
  Serial.println("Smart Home IoT Node - Smart Exhaust Fan (ESP32)");
  Serial.println("==================================================");

  // Retrieve hardware MAC Address from WiFi chip
  _macAddress = WiFi.macAddress();
  Serial.print("[WiFi] Device Hardware MAC: ");
  Serial.println(_macAddress);
  Serial.print("[Auth] Configured Pairing Code: ");
  Serial.println(PAIRING_CODE);
  Serial.print("[WiFi] Connecting to SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

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
    Serial.println("[WiFi] Warning: Could not connect to WiFi. Will retry in main loop...");
  }
}

void WiFiService::update() {
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long now = millis();
    if (now - _lastReconnectAttempt >= 10000) {
      _lastReconnectAttempt = now;
      Serial.println("[WiFi] Reconnecting to WiFi...");
      WiFi.disconnect();
      WiFi.reconnect();
    }
  }
}

bool WiFiService::isConnected() const {
  return WiFi.status() == WL_CONNECTED;
}

IPAddress WiFiService::getIpAddress() const {
  return WiFi.localIP();
}
