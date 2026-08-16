#include <Arduino.h>

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
#elif defined(ESP32)
  #include <WiFi.h>
#endif

#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "types.h"
#include "exhaust_fan_fsm.h"

// ============================================================
// GLOBAL OBJECTS & STATE
// ============================================================
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
ExhaustFanFSM fanFSM;

unsigned long lastTelemetryTime = 0;
String deviceMac = "";
const char* telemetryTopic = "iot/telemetry";

// ============================================================
// TELEMETRY & STATE PUBLISHING
// ============================================================
void publishState(bool force = false) {
  // Construct JSON State Payload compatible with Backend DTO & Web Admin
  StaticJsonDocument<384> doc;
  doc["pairingCode"]      = PAIRING_CODE;
  doc["macAddress"]       = deviceMac;
  doc["deviceUid"]        = DEFAULT_DEVICE_UID;
  doc["power"]             = fanFSM.getActualPower();
  doc["direction"]         = directionToString(fanFSM.getActualDirection());
  doc["desiredPower"]      = fanFSM.getDesiredPower();
  doc["desiredDirection"]  = directionToString(fanFSM.getDesiredDirection());
  doc["ductPosition"]      = ductPositionToString(fanFSM.getDuctPosition());
  doc["operationState"]    = operationStateToString(fanFSM.getOperationState());
  doc["errorCode"]         = errorCodeToString(fanFSM.getErrorCode());

  char jsonBuffer[384];
  serializeJson(doc, jsonBuffer);

  if (mqttClient.connected()) {
    if (mqttClient.publish(telemetryTopic, jsonBuffer)) {
      Serial.print("[MQTT] State Published -> ");
      Serial.print(telemetryTopic);
      Serial.print(" : ");
      Serial.println(jsonBuffer);
      fanFSM.clearStateChanged();
    } else {
      Serial.println("[MQTT] Error: Failed to publish state message!");
    }
  }
}

// ============================================================
// MQTT COMMAND CALLBACK (State-Aware)
// ============================================================
void mqttCallback(char* topic, byte* payloadBytes, unsigned int length) {
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
  StaticJsonDocument<384> doc;
  DeserializationError err = deserializeJson(doc, message);
  if (err) {
    Serial.print("[MQTT] JSON parse error: ");
    Serial.println(err.c_str());
    return;
  }

  // 3. Extract Command Action & Direction
  const char* action = doc["action"] | "";
  const char* dirStr = doc["direction"] | "";

  // Check if clear_error requested
  if (strcmp(action, "clear_error") == 0 || strcmp(action, "reset") == 0) {
    fanFSM.clearError();
    publishState(true);
    return;
  }

  // Handle ON command
  if (strcmp(action, "on") == 0) {
    if (strlen(dirStr) > 0) {
      fanFSM.requestDirection(stringToDirection(dirStr));
    }
    fanFSM.requestPower(true);
  }
  // Handle OFF command
  else if (strcmp(action, "off") == 0) {
    fanFSM.requestPower(false);
  }
  // Handle SET_DIRECTION command
  else if (strcmp(action, "set_direction") == 0) {
    if (strlen(dirStr) > 0) {
      fanFSM.requestDirection(stringToDirection(dirStr));
    }
  } else {
    Serial.print("[MQTT] Unknown command action: ");
    Serial.println(action);
  }

  // Publish updated state immediately
  publishState(true);
}

// ============================================================
// WIFI SETUP & RECONNECT
// ============================================================
void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.println("==================================================");
  Serial.println("Smart Home IoT Node - Smart Exhaust Fan (ESP32)");
  Serial.println("==================================================");

  deviceMac = WiFi.macAddress();
  Serial.print("[WiFi] Device Hardware MAC: ");
  Serial.println(deviceMac);
  Serial.print("[Auth] Configured Pairing Code: ");
  Serial.println(PAIRING_CODE);
  Serial.print("[WiFi] Connecting to: ");
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

// ============================================================
// MQTT SETUP & RECONNECT
// ============================================================
void setupMQTT() {
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Lost connection, reconnecting WiFi...");
      WiFi.reconnect();
      delay(3000);
      return;
    }

    Serial.print("[MQTT] Connecting to broker ");
    Serial.print(MQTT_BROKER);
    Serial.print(":");
    Serial.println(MQTT_PORT);

    String cleanMac = deviceMac;
    cleanMac.replace(":", "");
    String clientId = String("ESP-EF-") + cleanMac.substring(cleanMac.length() > 6 ? cleanMac.length() - 6 : 0);

    bool connected = false;
    if (strlen(MQTT_USER) > 0) {
      connected = mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD);
    } else {
      connected = mqttClient.connect(clientId.c_str());
    }

    if (connected) {
      Serial.println("[MQTT] Connected to MQTT broker successfully!");

      // Subscribe to command topic patterns
      mqttClient.subscribe("home/+/+/+/command");
      mqttClient.subscribe("iot/+/command");
      Serial.println("[MQTT] Subscribed to command topics: home/+/+/+/command, iot/+/command");

      // Broadcast initial boot state
      publishState(true);
    } else {
      Serial.print("[MQTT] Failed connection, state=");
      Serial.print(mqttClient.state());
      Serial.println(" - Retrying in 5 seconds...");
      delay(5000);
    }
  }
}

// ============================================================
// ARDUINO SETUP & LOOP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  // Initialize Hardware & FSM
  fanFSM.begin();

  // Initialize Network & MQTT
  setupWiFi();
  setupMQTT();
}

void loop() {
  // 1. Maintain WiFi & MQTT connectivity
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      reconnectMQTT();
    }
    mqttClient.loop();
  }

  // 2. Tick the non-blocking Exhaust Fan Finite State Machine
  fanFSM.update();

  // 3. Publish Telemetry periodically or whenever internal state changes
  unsigned long now = millis();
  if (fanFSM.hasStateChanged() || (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS)) {
    lastTelemetryTime = now;
    publishState();
  }
}