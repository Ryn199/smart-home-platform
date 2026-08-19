#pragma once

#include <Arduino.h>

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
#elif defined(ESP32)
  #include <WiFi.h>
#endif

#include <PubSubClient.h>
#include "config.h"
#include "types.h"
#include "exhaust_fan_fsm.h"

class MqttService {
public:
  MqttService();

  void begin(ExhaustFanFSM* fsm, const String& macAddress);
  void update();

  void publishState(bool force = false);
  bool publishDiagnostics();
  bool isConnected();

private:
  void handleMessage(char* topic, byte* payload, unsigned int length);
  void reconnect();

  WiFiClient _wifiClient;
  PubSubClient _mqttClient;
  ExhaustFanFSM* _fsm;
  String _macAddress;
  unsigned long _lastTelemetryTime;
  unsigned long _lastReconnectAttempt;
};

extern MqttService mqttService;
