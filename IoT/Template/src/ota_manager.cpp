#include "ota_manager.h"
#include "config.h"
#include "wifi_manager.h"
#include "storage_manager.h"
#include "mqtt_handler.h"

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266httpUpdate.h>
#elif defined(ESP32)
  #include <WiFi.h>
  #include <HTTPUpdate.h>
#endif

void initOTAManager() {
  pinMode(LED_INDICATOR_PIN, OUTPUT);
}

#if defined(ESP8266)
static void updateProgressCallback(int current, int total) {
  if (total > 0) {
    int percent = (current * 100) / total;
    Serial.printf("[OTA] Downloading binary: %d%% (%d / %d bytes)\r", percent, current, total);
  }
}
#elif defined(ESP32)
static void updateProgressCallback(size_t current, size_t total) {
  if (total > 0) {
    size_t percent = (current * 100) / total;
    Serial.printf("[OTA] Downloading binary: %u%% (%u / %u bytes)\r", (unsigned int)percent, (unsigned int)current, (unsigned int)total);
  }
}
#endif

bool startFirmwareOTA(const char* url, const char* version, const char* checksum, size_t expectedSize) {
  if (!isWiFiConnected()) {
    Serial.println("[OTA] Error: WiFi is not connected. Aborting OTA update.");
    publishOTAStatus("FAILED", version, "WiFi not connected");
    return false;
  }

  if (!url || strlen(url) == 0) {
    Serial.println("[OTA] Error: Invalid / empty download URL provided.");
    publishOTAStatus("FAILED", version, "Empty download URL");
    return false;
  }

  Serial.println();
  Serial.println("==================================================");
  Serial.println("[OTA] FIRMWARE OVER-THE-AIR (OTA) UPDATE INITIATED");
  Serial.printf("[OTA] Target Version : %s\n", (version && strlen(version) > 0) ? version : "Not specified");
  Serial.printf("[OTA] Target Backend : %s\n", url);
  if (checksum && strlen(checksum) > 0) {
    Serial.printf("[OTA] Expected SHA   : %s\n", checksum);
  }
  if (expectedSize > 0) {
    Serial.printf("[OTA] Expected Size  : %u bytes\n", (unsigned int)expectedSize);
  }
  Serial.println("==================================================");

  // Inform server via MQTT that ESP is starting download & flashing
  publishOTAStatus("FLASHING", version);

  // Turn ON external LED to indicate active firmware flashing in progress
  digitalWrite(LED_INDICATOR_PIN, HIGH);

  WiFiClient otaClient;
  // Increase timeout for binary streaming
  otaClient.setTimeout(15000);

#if defined(ESP8266)
  ESPhttpUpdate.setLedPin(LED_INDICATOR_PIN, HIGH);
  ESPhttpUpdate.onProgress(updateProgressCallback);
  
  // Follow redirects if any
  ESPhttpUpdate.followRedirects(true);

  Serial.println("[OTA] Connecting to backend HTTP API server...");
  t_httpUpdate_return ret = ESPhttpUpdate.update(otaClient, url);

  digitalWrite(LED_INDICATOR_PIN, LOW);

  switch (ret) {
    case HTTP_UPDATE_FAILED:
      Serial.println();
      Serial.printf("[OTA] ERROR: OTA Flash Failed! Code (%d): %s\n", 
        ESPhttpUpdate.getLastError(), 
        ESPhttpUpdate.getLastErrorString().c_str()
      );
      publishOTAStatus("FAILED", version, ESPhttpUpdate.getLastErrorString().c_str());
      return false;

    case HTTP_UPDATE_NO_UPDATES:
      Serial.println();
      Serial.println("[OTA] Notice: No newer updates found on server.");
      publishOTAStatus("FAILED", version, "No newer updates found");
      return false;

    case HTTP_UPDATE_OK:
      Serial.println();
      Serial.println("[OTA] SUCCESS! Firmware successfully flashed into ESP flash memory.");
      
      // Save dynamic firmware version into EEPROM before rebooting
      if (version && strlen(version) > 0) {
        saveFirmwareVersion(version);
      }
      
      publishOTAStatus("SUCCESS_REBOOTING", version);
      Serial.println("[OTA] Device is rebooting now into new firmware...");
      delay(500);
      return true;
  }

#elif defined(ESP32)
  httpUpdate.setLedPin(LED_INDICATOR_PIN, HIGH);
  httpUpdate.onProgress(updateProgressCallback);

  Serial.println("[OTA] Connecting to backend HTTP API server...");
  t_httpUpdate_return ret = httpUpdate.update(otaClient, url);

  digitalWrite(LED_INDICATOR_PIN, LOW);

  switch (ret) {
    case HTTP_UPDATE_FAILED:
      Serial.println();
      Serial.printf("[OTA] ERROR: OTA Flash Failed! Code (%d): %s\n", 
        httpUpdate.getLastError(), 
        httpUpdate.getLastErrorString().c_str()
      );
      publishOTAStatus("FAILED", version, httpUpdate.getLastErrorString().c_str());
      return false;

    case HTTP_UPDATE_NO_UPDATES:
      Serial.println();
      Serial.println("[OTA] Notice: No newer updates found on server.");
      publishOTAStatus("FAILED", version, "No newer updates found");
      return false;

    case HTTP_UPDATE_OK:
      Serial.println();
      Serial.println("[OTA] SUCCESS! Firmware successfully flashed into ESP flash memory.");
      
      // Save dynamic firmware version into EEPROM before rebooting
      if (version && strlen(version) > 0) {
        saveFirmwareVersion(version);
      }

      publishOTAStatus("SUCCESS_REBOOTING", version);
      Serial.println("[OTA] Device is rebooting now into new firmware...");
      delay(500);
      return true;
  }
#endif

  digitalWrite(LED_INDICATOR_PIN, LOW);
  return false;
}
