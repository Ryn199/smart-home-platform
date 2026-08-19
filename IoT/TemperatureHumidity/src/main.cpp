#include <Arduino.h>
#include "config.h"
#include "storage_manager.h"
#include "dht_sensor.h"
#include "wifi_manager.h"
#include "mqtt_handler.h"
#include "web_portal.h"
#include "ota_manager.h"

static unsigned long lastTelemetryTime = 0;

void setup() {
  Serial.begin(115200);
  delay(500);

  initStorage();
  initPortalHardware();
  initOTAManager();

  // Check if trigger button is held during power-up / boot
  if (isTriggerPressed()) {
    startConfigPortal();
  }

  setupDHT();
  setupWiFi();
  setupMQTT();
}

void loop() {
  // Check if trigger button is pressed during normal operation
  if (isTriggerPressed()) {
    startConfigPortal();
  }

  maintainMQTT();

  unsigned long currentMillis = millis();
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = currentMillis;

    float temperature = 0.0;
    float humidity = 0.0;
    if (readDHT(temperature, humidity)) {
      publishTelemetry(temperature, humidity);
    }
  }
}