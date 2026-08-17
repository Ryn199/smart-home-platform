#include <Arduino.h>
#include "exhaust_fan_fsm.h"
#include "wifi_service.h"
#include "mqtt_service.h"

// ============================================================
// GLOBAL STATE MACHINE INSTANCE
// ============================================================
ExhaustFanFSM fanFSM;

// ============================================================
// ARDUINO SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  // 1. Initialize Hardware Components & State Machine
  fanFSM.begin();

  // 2. Initialize WiFi Connection
  wifiService.begin();

  // 3. Initialize MQTT Service with FSM reference and Device MAC
  mqttService.begin(&fanFSM, wifiService.getMacAddress());
}

// ============================================================
// ARDUINO MAIN LOOP
// ============================================================
void loop() {
  // 1. Service WiFi Network Reconnects
  wifiService.update();

  // 2. Service MQTT Commands & Telemetry Loop
  mqttService.update();

  // 3. Service Exhaust Fan Finite State Machine & Safety Interlocks
  fanFSM.update();
}