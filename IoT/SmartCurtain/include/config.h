#pragma once

// ============================================================
// SMART HOME PLATFORM - SMART CURTAIN IOT NODE CONFIGURATION
// (Stepper Motor Driver: STEP, DIR, EN + 2 IR Limit Sensors)
// ============================================================

// 1. Default WiFi Network Credentials (Used when EEPROM is uninitialized)
#define WIFI_SSID       "Ryn-IoT"
#define WIFI_PASSWORD   "IoT11191205!"

// 2. Default MQTT Broker Configuration (Used when EEPROM is uninitialized)
#define MQTT_BROKER     "202.10.41.155"   // IP Address or Hostname of MQTT Broker
#define MQTT_PORT       1883
#define MQTT_USER       "mqttuser"        // Leave blank if no auth
#define MQTT_PASSWORD   "11191205"        // Leave blank if no auth

// 3. Hardware Authentication (Pairing Code)
#define PAIRING_CODE    "awsrgwegfq4GQEGQ290468TYH"

// 4. Hardware Pinout Definition (Stepper Motor Driver & 2 IR Limit Sensors)
#if defined(ESP8266)
  #define TRIGGER_PIN         0   // GPIO0 (Flash Button on NodeMCU) -> Config portal
  #define LED_INDICATOR_PIN  14   // GPIO14 (Pin D5) -> External LED
  #define STEP_PIN           12   // GPIO12 (Pin D6) -> Driver STEP pin
  #define DIR_PIN            13   // GPIO13 (Pin D7) -> Driver DIR pin
  #define EN_PIN             15   // GPIO15 (Pin D8) -> Driver EN pin (LOW = Enabled)
  #define IR_TOP_PIN          4   // GPIO4 (Pin D2)  -> IR Sensor Top (Opened Limit)
  #define IR_BOTTOM_PIN       5   // GPIO5 (Pin D1)  -> IR Sensor Bottom (Closed Limit)
#elif defined(ESP32)
  #define TRIGGER_PIN        22   // GPIO22 (Pin D22) -> Web Config trigger button (connect to GND)
  #define LED_INDICATOR_PIN  23   // GPIO23 (Pin D23) -> External Status & Portal LED
  #define STEP_PIN            2   // GPIO2  (Pin D2)  -> Driver STEP pin
  #define DIR_PIN             4   // GPIO4  (Pin D4)  -> Driver DIR pin
  #define EN_PIN              5   // GPIO5  (Pin D5)  -> Driver EN pin (LOW = Enabled)
  #define IR_TOP_PIN         19   // GPIO19 (Pin D19) -> IR Sensor Top (Opened Limit)
  #define IR_BOTTOM_PIN      21   // GPIO21 (Pin D21) -> IR Sensor Bottom (Closed Limit)
#endif

// 5. Stepper Motor & IR Sensor Parameters
#define IR_ACTIVE_LEVEL       LOW    // LOW when IR sensor detects blind obstacle (common for FC-51 / IR modules)
#define TOTAL_STEPS_RANGE    4000    // Estimated total steps from fully closed (0%) to fully open (100%)
#define OVERTRAVEL_STEPS      200    // Extra steps to move (~2cm) after IR sensor triggers before stopping motor
#define STEP_INTERVAL_US      1000   // Microseconds per step pulse (controls stepper speed)

// Driver Enable Active State (A4988 / DRV8825 / TMC2208 use LOW for Enable)
#define DRIVER_ENABLE_LEVEL   LOW
#define DRIVER_DISABLE_LEVEL  HIGH

// Direction pin orientation (adjust if motor turns backward)
#define DIR_UP_LEVEL          HIGH   // Roll up (OPEN)
#define DIR_DOWN_LEVEL        LOW    // Roll down (CLOSE)

// Diagnostics Interval (in milliseconds)
#define DIAGNOSTICS_INTERVAL_MS 60000
