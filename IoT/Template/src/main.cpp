#include <Arduino.h>
#include "config.h"
#include "storage_manager.h"
#include "wifi_manager.h"
#include "mqtt_handler.h"
#include "web_portal.h"
#include "ota_manager.h"

static unsigned long lastDiagnosticsTime = 0;

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

  setupWiFi();
  setupMQTT();
}

void loop() {
  // Check if trigger button is pressed during normal operation
  if (isTriggerPressed()) {
    startConfigPortal();
  }

  maintainMQTT();

  // Periodically send diagnostics
  unsigned long currentMillis = millis();
  if (currentMillis - lastDiagnosticsTime >= DIAGNOSTICS_INTERVAL_MS) {
    lastDiagnosticsTime = currentMillis;
    publishDiagnostics();
  }
}
