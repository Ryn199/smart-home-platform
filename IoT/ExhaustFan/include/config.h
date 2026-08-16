#pragma once

// ============================================================
// SMART HOME PLATFORM - IOT SMART EXHAUST FAN NODE CONFIGURATION
// ============================================================

// 1. WiFi Network Credentials
#define WIFI_SSID               "Wokwi-GUEST"
#define WIFI_PASSWORD           ""

// 2. MQTT Broker Configuration
#define MQTT_BROKER             "202.10.41.155"   // Broker IP / Hostname
#define MQTT_PORT               1883
#define MQTT_USER               "mqttuser"        // Leave blank if no auth
#define MQTT_PASSWORD           "11191205"        // Leave blank if no auth

// 3. Hardware Authentication & Device Identity
// Matches the "Pairing Code" entered when registering the device in Web Admin.
#define PAIRING_CODE            "EF-7788"
#define DEFAULT_DEVICE_UID      "EF-KRR-01"

// 4. Hardware Pinout Configuration
#if defined(ESP32)
  #define PIN_RELAY_POWER       26    // Relay 1: Controls Main Fan AC Power
  #define PIN_RELAY_DIRECTION   27    // Relay 2: Direction (NC = EXHAUST, NO = INTAKE)
  #define PIN_SERVO             13    // Servo pin: Cord pull mechanism for duct
  #define PIN_LIMIT_OPEN        32    // Limit Switch 1: Duct fully OPEN (Active LOW with pullup)
  #define PIN_LIMIT_CLOSE       33    // Limit Switch 2: Duct fully CLOSED (Active LOW with pullup)
#elif defined(ESP8266)
  #define PIN_RELAY_POWER       12    // D6 (GPIO12)
  #define PIN_RELAY_DIRECTION   14    // D5 (GPIO14)
  #define PIN_SERVO             13    // D7 (GPIO13)
  #define PIN_LIMIT_OPEN        4     // D2 (GPIO4)
  #define PIN_LIMIT_CLOSE       5     // D1 (GPIO5)
#endif

// 5. Active Logic Levels
// Optocoupled relay modules typically activate on LOW level
#define RELAY_ACTIVE_LEVEL      LOW
#define RELAY_INACTIVE_LEVEL    HIGH

// Limit switches connected to GND with INPUT_PULLUP (Active LOW when pressed)
#define LIMIT_ACTIVE_LEVEL      LOW

// Direction Relay Mapping
// NC (Normally Closed) = EXHAUST (Relay INACTIVE)
// NO (Normally Open)   = INTAKE  (Relay ACTIVE)
#define RELAY_DIR_EXHAUST_LEVEL RELAY_INACTIVE_LEVEL
#define RELAY_DIR_INTAKE_LEVEL  RELAY_ACTIVE_LEVEL

// 6. Safety & Timing Configurations (All in milliseconds)
#define MOTOR_STOP_DELAY_MS         3000   // Wait 3 seconds for inertia before direction reverse
#define RELAY_SETTLE_DELAY_MS       500    // Wait 500ms for relay contacts to debounce & settle
#define DUCT_OPERATION_TIMEOUT_MS   6000   // Timeout if limit switch not reached within 6 seconds
#define LIMIT_DEBOUNCE_MS           50     // Debounce filter for limit switches
#define TELEMETRY_INTERVAL_MS       2000   // Telemetry broadcast rate (2 seconds)

// 7. Servo Mechanical Pull Stroke Parameters
#define SERVO_REST_ANGLE            0      // Rest position (degrees)
#define SERVO_PULL_ANGLE            90     // Pull stroke position (degrees)
#define SERVO_STROKE_HOLD_MS        400    // Time to hold pull before returning
#define SERVO_STROKE_PAUSE_MS       300    // Pause between consecutive pull cycles
