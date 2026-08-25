#include "mqtt_handler.h"
#include "wifi_manager.h"
#include "storage_manager.h"
#include "web_portal.h"
#include "ota_manager.h"
#include "config.h"

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
#elif defined(ESP32)
  #include <WiFi.h>
  #include <esp_system.h>
#endif

#include <PubSubClient.h>
#include <ArduinoJson.h>

static WiFiClient wifiClient;
static PubSubClient mqttClient(wifiClient);
static const char* diagnosticsTopic = "iot/diagnostics";
static const char* otaStatusTopic = "iot/ota/status";

// Helper to get reset reason string
static String getResetReasonString() {
#if defined(ESP32)
  esp_reset_reason_t reason = esp_reset_reason();
  switch (reason) {
    case ESP_RST_POWERON:   return "POWERON_RESET";
    case ESP_RST_SW:        return "SW_CPU_RESET";
    case ESP_RST_PANIC:     return "PANIC_RESET";
    case ESP_RST_INT_WDT:   return "INT_WDT_RESET";
    case ESP_RST_TASK_WDT:  return "TASK_WDT_RESET";
    case ESP_RST_WDT:       return "OTHER_WDT_RESET";
    case ESP_RST_DEEPSLEEP: return "DEEPSLEEP_RESET";
    case ESP_RST_BROWNOUT:  return "BROWNOUT_RESET";
    case ESP_RST_SDIO:      return "SDIO_RESET";
    default:                return "UNKNOWN_RESET";
  }
#elif defined(ESP8266)
  return ESP.getResetReason();
#else
  return "UNKNOWN";
#endif
}

// Callback for incoming MQTT commands (restart, diagnostics refresh, web config, ota update, etc.)
static void mqttCallback(char* topic, byte* payloadBytes, unsigned int length) {
  char message[512];
  if (length >= sizeof(message)) {
    Serial.println("[MQTT] Warning: Command payload too large. Ignored.");
    return;
  }
  memcpy(message, payloadBytes, length);
  message[length] = '\0';

  Serial.print("[MQTT] Received command on topic: ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(message);

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, message);
  if (err) {
    Serial.print("[MQTT] JSON parse error: ");
    Serial.println(err.c_str());
    return;
  }

  const char* action = doc["action"] | "";

  if (strcmp(action, "restart") == 0 || strcmp(action, "reboot") == 0) {
    Serial.println("[MQTT] Restart command received! Rebooting ESP in 500ms...");
    delay(500);
    ESP.restart();
  } else if (strcmp(action, "get_diagnostics") == 0 || strcmp(action, "get_status") == 0 || strcmp(action, "ping") == 0) {
    Serial.println("[MQTT] Diagnostics request received. Publishing latest status...");
    publishDiagnostics();
  } else if (strcmp(action, "open_config") == 0 || strcmp(action, "config_portal") == 0 || strcmp(action, "web_config") == 0 || strcmp(action, "open_web_config") == 0) {
    Serial.println("[MQTT] Open Web Config command received! Entering Web Configuration Portal mode...");
    startConfigPortal();
  } else if (strcmp(action, "ota_update") == 0 || strcmp(action, "update_firmware") == 0 || strcmp(action, "flash_firmware") == 0) {
    const char* otaUrl = doc["url"] | "";
    const char* targetVersion = doc["version"] | "";
    const char* checksum = doc["checksum"] | "";
    size_t fileSize = doc["fileSize"] | 0;

    if (strlen(otaUrl) > 0) {
      Serial.printf("[MQTT] OTA update command received -> Target: v%s, URL: %s\n", targetVersion, otaUrl);
      startFirmwareOTA(otaUrl, targetVersion, checksum, fileSize);
    } else {
      Serial.println("[MQTT] Error: ota_update command missing download URL!");
    }
  } else {
    Serial.print("[MQTT] Unhandled command action: ");
    Serial.println(action);
  }
}

static void reconnectMQTT() {
  const AppConfig& config = getConfig();

  while (!mqttClient.connected()) {
    if (!isWiFiConnected()) {
      Serial.println("[WiFi] Lost connection, reconnecting WiFi...");
      reconnectWiFi();
      delay(3000);
      return;
    }

    Serial.print("[MQTT] Connecting to broker ");
    Serial.print(config.mqttBroker);
    Serial.print(":");
    Serial.println(config.mqttPort);

    // Client ID generated with pairing code and partial MAC
    String cleanMac = getDeviceMac();
    cleanMac.replace(":", "");
    String clientId = String("ESP-Node-") + cleanMac.substring(cleanMac.length() > 6 ? cleanMac.length() - 6 : 0);

    bool connected = false;
    if (strlen(config.mqttUser) > 0) {
      connected = mqttClient.connect(clientId.c_str(), config.mqttUser, config.mqttPassword);
    } else {
      connected = mqttClient.connect(clientId.c_str());
    }

    if (connected) {
      Serial.println("[MQTT] Connected to MQTT broker successfully!");

      // Subscribe to command topic patterns
      mqttClient.subscribe("home/+/+/+/command");
      mqttClient.subscribe("iot/+/command");
      mqttClient.subscribe("iot/command");
      Serial.println("[MQTT] Subscribed to command topics.");

      // Broadcast initial boot diagnostics
      publishDiagnostics();
    } else {
      Serial.print("[MQTT] Failed connection, state=");
      Serial.print(mqttClient.state());
      Serial.println(" - Retrying in 5 seconds...");
      delay(5000);
    }
  }
}

void setupMQTT() {
  const AppConfig& config = getConfig();
  mqttClient.setServer(config.mqttBroker, config.mqttPort);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(768);
}

void maintainMQTT() {
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();
}

bool publishDiagnostics() {
  if (!mqttClient.connected()) return false;

  const AppConfig& config = getConfig();

  // ESP internal diagnostics metrics
  JsonDocument doc;
  doc["pairingCode"]     = config.pairingCode;
  doc["macAddress"]      = getDeviceMac();
  doc["ipAddress"]       = WiFi.localIP().toString();
  doc["freeHeap"]        = ESP.getFreeHeap();
#if defined(ESP32)
  doc["minFreeHeap"]     = ESP.getMinFreeHeap();
  doc["internalTemp"]    = round(temperatureRead() * 10.0) / 10.0;
#elif defined(ESP8266)
  doc["minFreeHeap"]     = ESP.getFreeHeap();
  doc["internalTemp"]    = 0.0;
#endif
  doc["rssi"]            = WiFi.RSSI();
  doc["uptime"]          = millis();
  doc["resetReason"]     = getResetReasonString();
  doc["firmwareVersion"] = getFirmwareVersion();
  doc["flashChipSize"]   = ESP.getFlashChipSize();
  doc["sketchSize"]      = ESP.getSketchSize();
  doc["cpuFreq"]         = ESP.getCpuFreqMHz();

  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);

  bool ok = mqttClient.publish(diagnosticsTopic, jsonBuffer);
  if (ok) {
    Serial.print("[MQTT] Diagnostics published -> ");
    Serial.print(diagnosticsTopic);
    Serial.print(" : ");
    Serial.println(jsonBuffer);
  } else {
    Serial.println("[MQTT] Error: Failed to publish diagnostics message!");
  }
  return ok;
}

bool publishOTAStatus(const char* status, const char* version, const char* errorMsg) {
  if (!mqttClient.connected()) return false;

  const AppConfig& config = getConfig();

  JsonDocument doc;
  doc["pairingCode"]     = config.pairingCode;
  doc["macAddress"]      = getDeviceMac();
  doc["status"]          = status;
  doc["targetVersion"]   = (version && strlen(version) > 0) ? version : "";
  doc["currentVersion"]  = getFirmwareVersion();
  if (errorMsg && strlen(errorMsg) > 0) {
    doc["error"] = errorMsg;
  }
  doc["timestamp"]       = millis();

  char jsonBuffer[384];
  serializeJson(doc, jsonBuffer);

  bool ok = mqttClient.publish(otaStatusTopic, jsonBuffer);
  if (ok) {
    Serial.print("[MQTT] OTA Status published -> ");
    Serial.print(otaStatusTopic);
    Serial.print(" : ");
    Serial.println(jsonBuffer);
  }
  return ok;
}
