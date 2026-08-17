#include "mqtt_service.h"
#include <ArduinoJson.h>

MqttService mqttService;

// Forward static callback to instance method
static void staticMqttCallback(char* topic, byte* payload, unsigned int length) {
  mqttService.publishState(false); // will be handled inside class
}

MqttService::MqttService()
  : _mqttClient(_wifiClient),
    _fsm(nullptr),
    _macAddress(""),
    _lastTelemetryTime(0),
    _lastReconnectAttempt(0) {
}

void MqttService::begin(ExhaustFanFSM* fsm, const String& macAddress) {
  _fsm = fsm;
  _macAddress = macAddress;

  _mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  _mqttClient.setBufferSize(512);

  // Bind callback using a lambda that delegates to this instance
  _mqttClient.setCallback([this](char* topic, byte* payload, unsigned int length) {
    this->handleMessage(topic, payload, length);
  });
}

void MqttService::handleMessage(char* topic, byte* payloadBytes, unsigned int length) {
  if (!_fsm) return;

  // 1. Convert payload to null-terminated string
  char message[512];
  if (length >= sizeof(message)) {
    Serial.println("[MQTT] Warning: Incoming command payload too large. Ignored.");
    return;
  }
  memcpy(message, payloadBytes, length);
  message[length] = '\0';

  Serial.print("[MQTT] Received command on topic: ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(message);

  // 2. Parse JSON Command
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, message);
  if (err) {
    Serial.print("[MQTT] JSON parse error: ");
    Serial.println(err.c_str());
    return;
  }

  // 3. Extract Command Action & Direction
  const char* action = doc["action"] | "";
  const char* dirStr = doc["direction"] | "";

  // Check if clear_error / reset requested
  if (strcmp(action, "clear_error") == 0 || strcmp(action, "reset") == 0) {
    _fsm->clearError();
    publishState(true);
    return;
  }

  // Handle ON command
  if (strcmp(action, "on") == 0) {
    if (strlen(dirStr) > 0) {
      _fsm->requestDirection(stringToDirection(dirStr));
    }
    _fsm->requestPower(true);
  }
  // Handle OFF command
  else if (strcmp(action, "off") == 0) {
    _fsm->requestPower(false);
  }
  // Handle SET_DIRECTION command
  else if (strcmp(action, "set_direction") == 0) {
    if (strlen(dirStr) > 0) {
      _fsm->requestDirection(stringToDirection(dirStr));
    }
  } else {
    Serial.print("[MQTT] Unknown command action: ");
    Serial.println(action);
  }

  // Broadcast state immediately on command receipt
  publishState(true);
}

void MqttService::reconnect() {
  if (_mqttClient.connected()) return;

  unsigned long now = millis();
  if (now - _lastReconnectAttempt < 5000) return;
  _lastReconnectAttempt = now;

  Serial.print("[MQTT] Connecting to broker ");
  Serial.print(MQTT_BROKER);
  Serial.print(":");
  Serial.println(MQTT_PORT);

  String cleanMac = _macAddress;
  cleanMac.replace(":", "");
  String clientId = String("ESP-EF-") + cleanMac.substring(cleanMac.length() > 6 ? cleanMac.length() - 6 : 0);

  bool connected = false;
  if (strlen(MQTT_USER) > 0) {
    connected = _mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD);
  } else {
    connected = _mqttClient.connect(clientId.c_str());
  }

  if (connected) {
    Serial.println("[MQTT] Connected to MQTT broker successfully!");

    // Subscribe to command topic patterns
    _mqttClient.subscribe("home/+/+/+/command");
    _mqttClient.subscribe("iot/+/command");
    Serial.println("[MQTT] Subscribed to command topics: home/+/+/+/command, iot/+/command");

    // Broadcast initial boot state
    publishState(true);
  } else {
    Serial.print("[MQTT] Failed connection, state=");
    Serial.print(_mqttClient.state());
    Serial.println(" - Will retry in 5 seconds...");
  }
}

void MqttService::publishState(bool force) {
  if (!_fsm || !_mqttClient.connected()) return;

  const char* telemetryTopic = "iot/telemetry";

  // Construct JSON State Payload compatible with Backend DTO & Web Admin
  JsonDocument doc;
  doc["pairingCode"]      = PAIRING_CODE;
  doc["macAddress"]       = _macAddress;
  doc["deviceUid"]        = DEFAULT_DEVICE_UID;
  doc["power"]             = _fsm->getActualPower();
  doc["direction"]         = directionToString(_fsm->getActualDirection());
  doc["desiredPower"]      = _fsm->getDesiredPower();
  doc["desiredDirection"]  = directionToString(_fsm->getDesiredDirection());
  doc["ductPosition"]      = ductPositionToString(_fsm->getDuctPosition());
  doc["operationState"]    = operationStateToString(_fsm->getOperationState());
  doc["errorCode"]         = errorCodeToString(_fsm->getErrorCode());

  char jsonBuffer[384];
  serializeJson(doc, jsonBuffer);

  if (_mqttClient.publish(telemetryTopic, jsonBuffer)) {
    Serial.print("[MQTT] State Published -> ");
    Serial.print(telemetryTopic);
    Serial.print(" : ");
    Serial.println(jsonBuffer);
    _fsm->clearStateChanged();
  } else {
    Serial.println("[MQTT] Error: Failed to publish state message!");
  }
}

void MqttService::update() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!_mqttClient.connected()) {
      reconnect();
    }
    _mqttClient.loop();
  }

  // Periodic Telemetry or on FSM State Change
  if (_fsm) {
    unsigned long now = millis();
    if (_fsm->hasStateChanged() || (now - _lastTelemetryTime >= TELEMETRY_INTERVAL_MS)) {
      _lastTelemetryTime = now;
      publishState();
    }
  }
}

bool MqttService::isConnected() {
  return _mqttClient.connected();
}
