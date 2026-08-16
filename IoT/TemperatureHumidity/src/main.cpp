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
const char* telemetryTopic = "iot/telemetry";

// ============================================================
// WIFI SETUP & RECONNECT
// ============================================================
void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.println("==================================================");
  Serial.println("Smart Home IoT Node - Temperature & Humidity (DHT22)");
  Serial.println("==================================================");

  // Retrieve hardware MAC Address from WiFi chip
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

    // Client ID generated with pairing code and partial MAC
    String cleanMac = deviceMac;
    cleanMac.replace(":", "");
    String clientId = String("ESP-TH-") + cleanMac.substring(cleanMac.length() > 6 ? cleanMac.length() - 6 : 0);

    bool connected = false;
    if (strlen(MQTT_USER) > 0) {
      connected = mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD);
    } else {
      connected = mqttClient.connect(clientId.c_str());
    }

    if (connected) {
      Serial.println("[MQTT] Connected to MQTT broker successfully!");
    } else {
      Serial.print("[MQTT] Failed connection, state=");
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
    Serial.println("[DHT22] Error: Failed to read from sensor! Check wiring and 10k pullup resistor.");
    return;
  }

  Serial.println("--------------------------------------------------");
  Serial.print("[DHT22] Suhu: ");
  Serial.print(temperature, 1);
  Serial.print(" °C | Kelembaban: ");
  Serial.print(humidity, 1);
  Serial.println(" %");

  // Construct authenticated JSON payload
  StaticJsonDocument<256> doc;
  doc["pairingCode"] = PAIRING_CODE;
  doc["macAddress"]  = deviceMac;
  doc["temperature"] = round(temperature * 10.0) / 10.0;
  doc["humidity"]    = round(humidity * 10.0) / 10.0;

  char jsonBuffer[256];
  serializeJson(doc, jsonBuffer);

  // Publish to standard telemetry topic: iot/telemetry
  if (mqttClient.publish(telemetryTopic, jsonBuffer)) {
    Serial.print("[MQTT] Published -> ");
    Serial.print(telemetryTopic);
    Serial.print(" : ");
    Serial.println(jsonBuffer);
  } else {
    Serial.println("[MQTT] Error: Failed to publish telemetry message!");
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