#include <Arduino.h>

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
#elif defined(ESP32)
  #include <WiFi.h>
#endif

#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include "config.h"

// ============================================================
// GLOBAL OBJECTS & STATE
// ============================================================
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastTelemetryTime = 0;
String deviceMac = "";
String telemetryTopic = "";
String stateTopic = "";
String statusTopic = "";

// ============================================================
// WIFI SETUP & RECONNECT
// ============================================================
void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.println("==================================================");
  Serial.println("Smart Home IoT Node - Temperature & Humidity");
  Serial.println("==================================================");

  // Retrieve hardware MAC Address
  deviceMac = WiFi.macAddress();
  Serial.print("[WiFi] Device Hardware MAC: ");
  Serial.println(deviceMac);

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
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("[WiFi] Failed to connect to WiFi. Will retry in loop...");
  }
}

// ============================================================
// MQTT SETUP & RECONNECT
// ============================================================
void setupMQTT() {
  // Build standard MQTT topics: home/{homeId}/{roomId}/{deviceUid}/...
  telemetryTopic = String("home/") + HOME_ID + "/" + ROOM_ID + "/" + DEVICE_UID + "/telemetry";
  stateTopic     = String("home/") + HOME_ID + "/" + ROOM_ID + "/" + DEVICE_UID + "/state";
  statusTopic    = String("home/") + HOME_ID + "/" + ROOM_ID + "/" + DEVICE_UID + "/status";

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Lost connection, reconnecting WiFi...");
      WiFi.reconnect();
      delay(3000);
      return;
    }

    Serial.print("[MQTT] Attempting connection to broker ");
    Serial.print(MQTT_BROKER);
    Serial.print(":");
    Serial.println(MQTT_PORT);

    // Client ID constructed with device UID and partial MAC
    String clientId = String("ESP-TH-") + DEVICE_UID;

    // Last Will and Testament (LWT) payload to mark device OFFLINE if abruptly disconnected
    StaticJsonDocument<128> lwtDoc;
    lwtDoc["status"] = "offline";
    lwtDoc["deviceUid"] = DEVICE_UID;
    char lwtPayload[128];
    serializeJson(lwtDoc, lwtPayload);

    bool connected = false;
    if (strlen(MQTT_USER) > 0) {
      connected = mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD,
                                    statusTopic.c_str(), 1, true, lwtPayload);
    } else {
      connected = mqttClient.connect(clientId.c_str(),
                                    statusTopic.c_str(), 1, true, lwtPayload);
    }

    if (connected) {
      Serial.println("[MQTT] Connected to broker successfully!");

      // Publish initial ONLINE status
      StaticJsonDocument<128> onlineDoc;
      onlineDoc["status"] = "online";
      onlineDoc["deviceUid"] = DEVICE_UID;
      onlineDoc["macAddress"] = deviceMac;
      onlineDoc["pairingCode"] = PAIRING_CODE;
      char onlinePayload[128];
      serializeJson(onlineDoc, onlinePayload);
      mqttClient.publish(statusTopic.c_str(), onlinePayload, true);
      Serial.println("[MQTT] Published online status with hardware credentials.");
    } else {
      Serial.print("[MQTT] Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" - Retrying in 5 seconds...");
      delay(5000);
    }
  }
}

// ============================================================
// READ SENSOR & PUBLISH TELEMETRY
// ============================================================
void readAndPublishTelemetry() {
  float temperature = dht.readTemperature(); // Read Celsius
  float humidity    = dht.readHumidity();    // Read Relative Humidity %

  // Check if any reads failed
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("[DHT22] Error: Failed to read from DHT sensor! Check wiring and pullup resistor.");
    return;
  }

  Serial.println("--------------------------------------------------");
  Serial.print("[DHT22] Temperature: ");
  Serial.print(temperature, 1);
  Serial.print(" °C | Humidity: ");
  Serial.print(humidity, 1);
  Serial.println(" %");

  // Construct authenticated JSON payload
  StaticJsonDocument<256> doc;
  doc["macAddress"]  = deviceMac;
  doc["pairingCode"] = PAIRING_CODE;
  doc["deviceUid"]   = DEVICE_UID;
  doc["temperature"] = serialized(String(temperature, 1));
  doc["humidity"]    = serialized(String(humidity, 1));

  char jsonBuffer[256];
  serializeJson(doc, jsonBuffer);

  // 1. Publish to telemetry topic
  if (mqttClient.publish(telemetryTopic.c_str(), jsonBuffer)) {
    Serial.print("[MQTT] Published -> ");
    Serial.print(telemetryTopic);
    Serial.print(" : ");
    Serial.println(jsonBuffer);
  } else {
    Serial.println("[MQTT] Failed to publish telemetry!");
  }
}

// ============================================================
// ARDUINO SETUP & LOOP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  dht.begin();
  setupWiFi();
  setupMQTT();
}

void loop() {
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  unsigned long currentMillis = millis();
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = currentMillis;
    readAndPublishTelemetry();
  }
}