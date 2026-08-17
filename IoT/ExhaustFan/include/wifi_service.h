#pragma once

#include <Arduino.h>

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
#elif defined(ESP32)
  #include <WiFi.h>
#endif

#include "config.h"

class WiFiService {
public:
  WiFiService();

  void begin();
  void update();

  bool isConnected() const;
  String getMacAddress() const { return _macAddress; }
  IPAddress getIpAddress() const;

private:
  String _macAddress;
  unsigned long _lastReconnectAttempt;
};

extern WiFiService wifiService;
